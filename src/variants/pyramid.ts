import type { Board } from "../core/board";
import { transferCards } from "../core/board";
import { cardLabel, createCards, KING } from "../core/cards";
import { type Layout, PileKind } from "../core/layout";
import { type Move, drawMove, transfer } from "../core/moves";
import { type Difficulty } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import { COLUMN_STEP, pileSpec } from "./common";
import { OverlapRules, SLOT_STEP, nodesBottom, pyramidNodes, slotSpecs } from "./overlap";

const ROWS = 7;
const SLOT_COUNT = (ROWS * (ROWS + 1)) / 2;
const PAIR_SUM = 13;

/** Passes through the stock per difficulty. */
const PASSES: Record<Difficulty, number> = { easy: Infinity, medium: 3, hard: 2 };

const NODES = pyramidNodes(ROWS, 3 * SLOT_STEP + 0.5);
const STOCK = SLOT_COUNT;
const WASTE = SLOT_COUNT + 1;
const DISCARD = SLOT_COUNT + 2;

function pyramidLayout(): Layout {
  const width = (ROWS - 1) * SLOT_STEP + 1;
  const bottomY = nodesBottom(NODES) + 0.25;
  return {
    width,
    height: bottomY + 1,
    piles: [
      ...slotSpecs(NODES),
      pileSpec(PileKind.Stock, 0, bottomY),
      pileSpec(PileKind.Waste, COLUMN_STEP, bottomY),
      pileSpec(PileKind.Foundation, width - 1, bottomY, { placeholder: "13" }),
    ],
  };
}

export class PyramidRules extends OverlapRules {
  protected override readonly passesMatter: boolean;

  public constructor(private readonly passes: number) {
    super(createCards(52), pyramidLayout(), NODES, true);
    this.passesMatter = Number.isFinite(passes);
  }

  public deal(seed: number): Board {
    const { board, rest } = this.dealSlots(seed);
    board.piles[STOCK].push(...rest);
    board.hidden[STOCK] = rest.length;
    return board;
  }

  /** A card may be used when uncovered in the pyramid or on top of the waste. */
  public canPick(board: Board, pile: number, index: number): boolean {
    if (index !== board.piles[pile].length - 1) {
      return false;
    }
    return pile === WASTE || (this.kindOf(pile) === PileKind.Slot && this.isAvailable(board, pile));
  }

  /** Only a King may be discarded on its own; everything else goes in pairs. */
  public canDrop(board: Board, from: number, index: number, to: number): boolean {
    return to === DISCARD && this.cardAt(board, from, index).rank === KING;
  }

  public override canDraw(board: Board): boolean {
    return board.piles[STOCK].length > 0 || (board.piles[WASTE].length > 0 && board.passes < this.passes - 1);
  }

  protected override performDraw(board: Board): void {
    if (board.piles[STOCK].length > 0) {
      transferCards(board, STOCK, WASTE, 1);
      return;
    }
    board.piles[STOCK].push(...board.piles[WASTE].reverse());
    board.piles[WASTE].length = 0;
    board.hidden[STOCK] = board.piles[STOCK].length;
    board.passes += 1;
  }

  protected override canPair(board: Board, a: number, b: number): boolean {
    if (a === b) {
      return false;
    }
    const first = this.topCard(board, a);
    const second = this.topCard(board, b);
    return (
      first !== undefined &&
      second !== undefined &&
      this.canPick(board, a, board.piles[a].length - 1) &&
      this.canPick(board, b, board.piles[b].length - 1) &&
      first.rank + second.rank === PAIR_SUM
    );
  }

  protected override performPair(board: Board, a: number, b: number): void {
    transferCards(board, a, DISCARD, 1);
    transferCards(board, b, DISCARD, 1);
  }

  /** Dropping a card on its partner pairs them. */
  public override resolveDrop(board: Board, from: number, index: number, to: number): Move | null {
    if (this.canPair(board, from, to)) {
      return { kind: "pair", a: from, b: to };
    }
    return super.resolveDrop(board, from, index, to);
  }

  public override usefulMoves(board: Board): Move[] {
    const sources = [WASTE, ...this.slots].filter((pile) => this.canPick(board, pile, board.piles[pile].length - 1));
    const moves: Move[] = [];
    sources.forEach((a, i) => {
      if (this.topCard(board, a)?.rank === KING) {
        moves.push(transfer(a, DISCARD));
      }
      for (const b of sources.slice(i + 1)) {
        if (this.canPair(board, a, b)) {
          moves.push({ kind: "pair", a, b });
        }
      }
    });
    if (this.canDraw(board)) {
      moves.push(drawMove);
    }
    return moves;
  }

  /** Prefer clearing the pyramid (deepest cards first) over using the waste. */
  public override moveHeuristic(_board: Board, move: Move): number {
    const depth = (pile: number): number => (pile < SLOT_COUNT ? 10 + NODES[pile].cy * 10 : 0);
    switch (move.kind) {
      case "draw":
        return 0;
      case "pair":
        return 20 + depth(move.a) + depth(move.b);
      case "move":
        return 30 + depth(move.from);
    }
  }

  public override describeMove(board: Board, move: Move): string {
    if (move.kind === "move") {
      const king = this.topCard(board, move.from);
      return king ? `Discard ${cardLabel(king)} — Kings are removed on their own` : "Discard the King";
    }
    return super.describeMove(board, move);
  }
}

export const pyramid: VariantDefinition = {
  id: "pyramid",
  name: "Pyramid",
  tagline: "Pair cards to make 13",
  difficulties: {
    easy: { label: "Unlimited", detail: "Recycle the stock as often as you like" },
    medium: { label: "3 passes", detail: "Go through the stock three times" },
    hard: { label: "2 passes", detail: "Only two passes through the stock" },
  },
  tutorial: [
    {
      title: "Goal",
      text: "Clear every card from the pyramid by removing pairs whose values add up to 13.",
      highlight: [PileKind.Slot],
    },
    {
      title: "Card values",
      text: "Ace = 1, numbers are face value, Jack = 11, Queen = 12. Kings are 13 on their own — tap a King to discard it.",
    },
    {
      title: "Making pairs",
      text: "Drag an uncovered card onto its partner, or tap one then the other. A card is uncovered when no card overlaps it from below.",
      highlight: [PileKind.Slot],
    },
    {
      title: "Stock & waste",
      text: "Tap the stock to turn up a new card. The top waste card can pair with the pyramid too.",
      highlight: [PileKind.Stock, PileKind.Waste],
    },
    {
      title: "Tips",
      text: "Look ahead: pairing the wrong 6 with a 7 can bury the card you need. Clear the lower rows early to open up choices.",
    },
  ],
  theme: { table: [0xc98b3a, 0x5a3212], accent: 0xffe08a, pattern: "bricks", ambient: "sand", intro: "pyramid" },
  solver: { strategy: "best-first", verifyNodes: 150_000, hintNodes: 40_000 },
  createRules: (difficulty) => new PyramidRules(PASSES[difficulty]),
};
