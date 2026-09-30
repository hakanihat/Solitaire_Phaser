import { type Board, createBoard, transferCards } from "../core/board";
import { anySuitDown, isRun, sameSuitDown } from "../core/building";
import { createCards, KING, Suit } from "../core/cards";
import { type Layout, PileKind } from "../core/layout";
import type { Move } from "../core/moves";
import { type Difficulty, Rules } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import {
  COLUMN_STEP,
  TABLEAU_TOP,
  collectCompletedRuns,
  dealColumns,
  layoutWidth,
  pileSpec,
  tableauRow,
} from "./common";

const SUITS: Record<Difficulty, readonly Suit[]> = {
  easy: [Suit.Spades],
  medium: [Suit.Spades, Suit.Hearts],
  // Four-suit Spider is beyond what the solver can verify in reasonable time,
  // and every deal in this collection must be provably winnable. "Hard" is
  // therefore two suits restricted to the deals that needed the deepest search.
  hard: [Suit.Spades, Suit.Hearts],
};

const COLUMNS = 10;
const STOCK = 0;

function spiderLayout(): Layout {
  return {
    width: layoutWidth(COLUMNS),
    height: TABLEAU_TOP + 1,
    piles: [
      pileSpec(PileKind.Stock, (COLUMNS - 1) * COLUMN_STEP, 0),
      ...Array.from({ length: 8 }, (_, i) =>
        pileSpec(PileKind.Foundation, i * COLUMN_STEP * 0.5, 0, { hideWhenEmpty: i > 0, z: i })
      ),
      ...tableauRow(COLUMNS, TABLEAU_TOP),
    ],
  };
}

export class SpiderRules extends Rules {
  public override readonly symmetricGroups: number[][];
  private readonly tableau: readonly number[];
  private readonly foundations: readonly number[];

  public constructor(suits: readonly Suit[]) {
    super(createCards(104, suits), spiderLayout());
    this.tableau = this.pilesOf(PileKind.Tableau);
    this.foundations = this.pilesOf(PileKind.Foundation);
    this.symmetricGroups = [[...this.foundations]];
  }

  public deal(seed: number): Board {
    const board = createBoard(this.layout.piles.length);
    const deck = this.shuffledIds(seed);
    const counts = this.tableau.map((_, i) => (i < 4 ? 6 : 5));
    dealColumns(
      board,
      deck,
      this.tableau,
      counts,
      counts.map((count) => count - 1)
    );
    board.piles[STOCK].push(...deck);
    board.hidden[STOCK] = deck.length;
    return board;
  }

  public canPick(board: Board, pile: number, index: number): boolean {
    return (
      this.kindOf(pile) === PileKind.Tableau &&
      index >= board.hidden[pile] &&
      isRun(this, board, pile, index, sameSuitDown)
    );
  }

  public canDrop(board: Board, from: number, index: number, to: number): boolean {
    if (this.kindOf(to) !== PileKind.Tableau) {
      return false;
    }
    const target = this.topCard(board, to);
    return target === undefined || anySuitDown(target, this.cardAt(board, from, index));
  }

  /** The stock deals a row onto every column, which must all be occupied. */
  public override canDraw(board: Board): boolean {
    return board.piles[STOCK].length > 0 && this.tableau.every((pile) => board.piles[pile].length > 0);
  }

  public override drawBlockedReason(board: Board): string {
    return board.piles[STOCK].length > 0 ? "Every column needs a card before you can deal." : "The stock is empty.";
  }

  /**
   * The deal needs a card in every column. Rather than make the player fill
   * the gaps by hand, pick legal moves that fill them while breaking as
   * little as possible: whole runs, preferably ones that uncover a face-down
   * card or are headed by a King (which can only ever go to an empty column).
   */
  public override prepareDraw(board: Board): Move[] | null {
    if (board.piles[STOCK].length === 0) {
      return null;
    }
    const moves: Move[] = [];
    let current = board;
    for (let empty = this.emptyColumn(current); empty !== undefined; empty = this.emptyColumn(current)) {
      const move = this.bestFill(current, empty);
      if (!move) {
        return null;
      }
      moves.push(move);
      current = this.apply(current, move);
    }
    return moves.length > 0 ? moves : null;
  }

  private emptyColumn(board: Board): number | undefined {
    return this.tableau.find((pile) => board.piles[pile].length === 0);
  }

  /** The least disruptive legal move into the empty column `to`. */
  private bestFill(board: Board, to: number): Move | null {
    let best: { move: Move; score: number } | null = null;
    for (const from of this.tableau) {
      const length = board.piles[from].length;
      if (from === to || length < 2) {
        continue;
      }
      // The longest movable run at the bottom of the column.
      let start = length - 1;
      while (start > board.hidden[from] && this.canPick(board, from, start - 1)) {
        start -= 1;
      }
      // Moving a whole column would only open another gap, so split it
      // instead, as a last resort.
      const splits = start === 0;
      const index = splits ? length - 1 : start;
      const move: Move = { kind: "move", from, to, count: length - index };
      if (!this.isLegal(board, move)) {
        continue;
      }
      const head = this.cardAt(board, from, index);
      const below = index - 1;
      let score = splits ? -20 : 0;
      if (below < board.hidden[from]) {
        score += 10;
      } else if (this.cardAt(board, from, below).rank === head.rank + 1) {
        score -= 4;
      }
      if (head.rank === KING) {
        score += 6;
      }
      if (!best || score > best.score) {
        best = { move, score };
      }
    }
    return best?.move ?? null;
  }

  protected override performDraw(board: Board): void {
    for (const pile of this.tableau) {
      transferCards(board, STOCK, pile, 1);
    }
  }

  protected override afterMove(board: Board, move: Move): void {
    collectCompletedRuns(this, board, this.tableau, this.foundations);
    super.afterMove(board, move);
  }

  protected override isPointless(board: Board, from: number, index: number, to: number): boolean {
    if (super.isPointless(board, from, index, to)) {
      return true;
    }
    if (index === board.hidden[from] || board.piles[to].length === 0) {
      return false;
    }
    // The run already sits on the next higher card. Moving it elsewhere only
    // helps if it upgrades an off-suit join into a same-suit one.
    const beneath = this.cardAt(board, from, index - 1);
    const moving = this.cardAt(board, from, index);
    if (!anySuitDown(beneath, moving)) {
      return false;
    }
    const target = this.topCard(board, to);
    return beneath.suit === moving.suit || target?.suit !== moving.suit;
  }

  /** Same-suit links are what eventually become removable runs. */
  public override evaluate(board: Board): number {
    let links = 0;
    for (const pile of this.tableau) {
      const cards = board.piles[pile];
      for (let i = Math.max(board.hidden[pile], 1); i < cards.length; i += 1) {
        const lower = this.cards[cards[i - 1]];
        const upper = this.cards[cards[i]];
        if (anySuitDown(lower, upper)) {
          links += upper.suit === lower.suit ? 3 : 1;
        }
      }
    }
    return super.evaluate(board) + links * 2;
  }

  public override moveHeuristic(board: Board, move: Move): number {
    let score = super.moveHeuristic(board, move);
    if (move.kind === "move") {
      const moving = this.cardAt(board, move.from, board.piles[move.from].length - move.count);
      const target = this.topCard(board, move.to);
      if (target?.suit === moving.suit) {
        score += 40; // same-suit joins build removable runs
      }
    }
    return score;
  }

  public override describeMove(board: Board, move: Move): string {
    return move.kind === "draw" ? "Deal a new row of cards" : super.describeMove(board, move);
  }
}

export const spider: VariantDefinition = {
  id: "spider",
  name: "Spider",
  tagline: "Two decks, ten columns",
  difficulties: {
    easy: { label: "1 suit", detail: "All spades" },
    medium: { label: "2 suits", detail: "Spades and hearts" },
    hard: { label: "2 suits · Expert", detail: "Two suits, with the trickiest verified deals" },
  },
  tutorial: [
    {
      title: "Goal",
      text: "Assemble complete runs from King down to Ace in a single suit. Each finished run flies off to the foundations. Clear all eight to win.",
      highlight: [PileKind.Foundation],
    },
    {
      title: "Building",
      text: "Place any card on a card one rank higher, whatever the suit. But only runs of the same suit can be moved as a group.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Empty columns",
      text: "Any card or same-suit run can move into an empty column. Use them to reorganise mixed-suit stacks.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Dealing",
      text: "Tap the stock to deal one new card onto every column. All columns must have at least one card first.",
      highlight: [PileKind.Stock],
    },
    {
      title: "Tips",
      text: "Prefer same-suit joins, and turn over face-down cards before dealing new rows.",
    },
  ],
  theme: {
    table: [0x4a4a5e, 0x15151f],
    accent: 0xff8a80,
    pattern: "web",
    ambient: "twinkle",
    intro: "cascade",
    emblem: "web",
  },
  solver: { strategy: "best-first", verifyNodes: 200_000, hintNodes: 40_000 },
  createRules: (difficulty) => new SpiderRules(SUITS[difficulty]),
};
