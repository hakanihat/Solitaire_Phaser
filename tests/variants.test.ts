import { describe, expect, it } from "vitest";
import { type Board } from "../src/core/board";
import { runToEnd, HintEngine } from "../src/core/hints";
import { DIFFICULTIES } from "../src/core/Rules";
import { solve } from "../src/core/solver";
import { VARIANTS } from "../src/variants";
import { KlondikeRules } from "../src/variants/klondike";
import { MeridianRules } from "../src/variants/meridian";
import { PileKind } from "../src/core/layout";

const allCardIds = (board: Board): number[] => board.piles.flat().sort((a, b) => a - b);

describe.each(VARIANTS.map((variant) => [variant.id, variant] as const))("%s", (_id, variant) => {
  it.each(DIFFICULTIES)("deals every card exactly once (%s)", (difficulty) => {
    const rules = variant.createRules(difficulty);
    const board = rules.deal(1234);
    expect(allCardIds(board)).toEqual(rules.cards.map((card) => card.id));
    expect(board.piles).toHaveLength(rules.layout.piles.length);
  });

  it("is deterministic for a seed", () => {
    const rules = variant.createRules("medium");
    expect(rules.deal(99)).toEqual(rules.deal(99));
  });

  it("only generates legal moves that conserve cards", () => {
    const rules = variant.createRules("medium");
    let board = rules.deal(5);
    for (let step = 0; step < 40; step += 1) {
      const moves = rules.usefulMoves(board);
      if (moves.length === 0) {
        break;
      }
      const move = moves[step % moves.length];
      expect(rules.isLegal(board, move)).toBe(true);
      board = rules.apply(board, move);
      expect(allCardIds(board)).toEqual(rules.cards.map((card) => card.id));
    }
  });

  it("has a tutorial and three difficulty labels", () => {
    expect(variant.tutorial.length).toBeGreaterThanOrEqual(3);
    DIFFICULTIES.forEach((difficulty) => expect(variant.difficulties[difficulty].label).not.toBe(""));
  });
});

describe("solver", () => {
  it("finds a replayable winning line for an easy Klondike deal", () => {
    const rules = new KlondikeRules({ draw: 1, passes: Infinity });
    let found = false;
    for (let seed = 1; seed < 10 && !found; seed += 1) {
      const start = rules.deal(seed);
      const result = solve(rules, start, { maxNodes: 60_000 });
      if (result.status === "solved") {
        found = true;
        const end = result.path.reduce((board, move) => {
          expect(rules.isLegal(board, move)).toBe(true);
          return rules.apply(board, move);
        }, start);
        expect(rules.isWon(end)).toBe(true);
      }
    }
    expect(found).toBe(true);
  });

  it("proves hopeless positions unsolvable", () => {
    // Meridian with no free cells and a deal the solver exhausts quickly.
    const rules = new MeridianRules(0);
    const statuses = [1, 2, 3, 4, 5].map(
      (seed) => solve(rules, rules.deal(seed), { maxNodes: 50_000, strategy: "best-first" }).status
    );
    expect(statuses).toContain("unsolvable");
  });
});

describe("hint engine", () => {
  it("follows a learned winning line instantly", () => {
    const rules = new MeridianRules(3);
    const profile = { strategy: "best-first", verifyNodes: 50_000, hintNodes: 20_000 } as const;
    const start = rules.deal(3);
    const { path, status } = solve(rules, start, { maxNodes: 50_000, strategy: "best-first" });
    expect(status).toBe("solved");
    const engine = new HintEngine(rules, profile);
    engine.learn(start, path);
    const hint = runToEnd(engine.think(rules.apply(start, path[0]), [start]));
    expect(hint).toMatchObject({ kind: "move", move: path[1], winning: true });
  });

  it("suggests undoing back to the last winnable position when lost", () => {
    const rules = new MeridianRules(0);
    const profile = { strategy: "best-first", verifyNodes: 50_000, hintNodes: 50_000 } as const;
    const outcomes = Array.from({ length: 40 }, (_, i) => {
      const board = rules.deal(i + 1);
      return { board, result: solve(rules, board, { maxNodes: 50_000, strategy: "best-first" }) };
    });
    const lost = outcomes.find((entry) => entry.result.status === "unsolvable");
    const won = outcomes.find((entry) => entry.result.status === "solved");
    expect(lost && won).toBeTruthy();
    const engine = new HintEngine(rules, profile);
    engine.learn(won!.board, won!.result.path);
    // History: two recent lost positions, then a winnable one three moves back.
    const hint = runToEnd(engine.think(lost!.board, [lost!.board, lost!.board, won!.board]));
    expect(hint).toMatchObject({ kind: "undo", steps: 3 });
  });
});

describe("auto-finish", () => {
  it.each(VARIANTS.map((variant) => [variant.id, variant] as const))(
    "is not offered on a fresh %s deal",
    (_id, variant) => {
      DIFFICULTIES.forEach((difficulty) => {
        const rules = variant.createRules(difficulty);
        expect(rules.canAutoFinish(rules.deal(42))).toBe(false);
      });
    }
  );
});

describe("tap to move", async () => {
  const { chooseTapMove } = await import("../src/core/tapMove");
  const { transfer } = await import("../src/core/moves");

  it("sends a playable Ace to the foundation", () => {
    const rules = new KlondikeRules({ draw: 1, passes: Infinity });
    // Find a deal with a face-up Ace on the tableau.
    for (let seed = 1; seed < 200; seed += 1) {
      const board = rules.deal(seed);
      const pile = rules.pilesOf(PileKind.Tableau).find((p) => rules.topCard(board, p)?.rank === 1);
      if (pile !== undefined) {
        const move = chooseTapMove(rules, board, pile, board.piles[pile].length - 1);
        expect(move).toMatchObject({ kind: "move", from: pile, count: 1 });
        expect(rules.kindOf((move as { to: number }).to)).toBe(PileKind.Foundation);
        return;
      }
    }
    throw new Error("no suitable deal found");
  });

  it("prefers the move on the known winning line", () => {
    const rules = new KlondikeRules({ draw: 1, passes: Infinity });
    const board = rules.deal(3);
    const pile = rules.pilesOf(PileKind.Tableau)[6];
    const index = board.piles[pile].length - 1;
    const options = rules.pilesOf(PileKind.Tableau).filter((to) => rules.resolveDrop(board, pile, index, to));
    if (options.length > 0) {
      const preferred = transfer(pile, options[options.length - 1], 1);
      expect(chooseTapMove(rules, board, pile, index, preferred)).toEqual(preferred);
    }
  });
});

describe("locked cards", () => {
  it("never greys out a card the player can pick up", () => {
    for (const variant of VARIANTS) {
      for (const difficulty of DIFFICULTIES) {
        const rules = variant.createRules(difficulty);
        const board = rules.deal(12345);
        board.piles.forEach((pile, p) =>
          pile.forEach((_, i) => {
            if (rules.canPick(board, p, i)) {
              expect(rules.isLocked(board, p, i), `${variant.id}/${difficulty} pile ${p} card ${i}`).toBe(false);
            }
          })
        );
      }
    }
  });
});
