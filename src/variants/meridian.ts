import { type Board, createBoard } from "../core/board";
import {
  ACE,
  ALL_SUITS,
  cardLabel,
  createCards,
  KING,
  RANKS_PER_SUIT,
  rankLabel,
  type Suit,
  suitSymbol,
} from "../core/cards";
import { type Layout, PileKind, type PileSpec } from "../core/layout";
import { type Move, transfer } from "../core/moves";
import { type Difficulty, Rules } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import { COLUMN_STEP, TABLEAU_TOP, dealColumns, layoutWidth, pileSpec, tableauRow } from "./common";

/*
 * MERIDIAN — an original solitaire designed for this collection.
 *
 * Every suit has two foundations: a Sunrise pile that climbs from Ace upward
 * and a Sunset pile that descends from King downward. A suit is finished when
 * the two meet somewhere in the middle — and *where* they meet is up to you.
 *
 * The tableau is fully open. Cards move one at a time and build on a card of
 * the same suit one rank higher OR lower, so a 6♥ can rest on a 5♥ or a 7♥.
 * A few free cells help untangle buried cards.
 *
 * Design intent: classic open games (FreeCell) always force Aces out first.
 * Two-ended foundations double the number of useful targets early on and turn
 * each suit into a small routing puzzle: dig from the top or the bottom?
 */

const CELLS: Record<Difficulty, number> = { easy: 3, medium: 2, hard: 1 };
const COLUMNS = 8;
/** Foundations are laid out as [rise♥, set♥, rise♦, set♦, …]. */
const FOUNDATIONS = ALL_SUITS.length * 2;

type Direction = 1 | -1;

/** Card ids of a single 52-card table are laid out suit by suit. */
const cardId = (suit: Suit, rank: number): number => suit * RANKS_PER_SUIT + rank - 1;

function meridianLayout(cells: number): Layout {
  const foundations: PileSpec[] = ALL_SUITS.flatMap((suit, i) => [
    pileSpec(PileKind.Foundation, 2 * i * COLUMN_STEP, 0, { suit, placeholder: `A${suitSymbol(suit)}` }),
    pileSpec(PileKind.Foundation, (2 * i + 1) * COLUMN_STEP, 0, { suit, placeholder: `K${suitSymbol(suit)}` }),
  ]);
  const firstCell = (COLUMNS - cells) / 2;
  const cellSpecs = Array.from({ length: cells }, (_, i) =>
    pileSpec(PileKind.Cell, (firstCell + i) * COLUMN_STEP, TABLEAU_TOP)
  );
  return {
    width: layoutWidth(COLUMNS),
    height: 2 * TABLEAU_TOP + 1,
    piles: [...foundations, ...cellSpecs, ...tableauRow(COLUMNS, 2 * TABLEAU_TOP)],
  };
}

export class MeridianRules extends Rules {
  public override readonly symmetricGroups: number[][];
  private readonly cells: readonly number[];
  private readonly tableau: readonly number[];

  public constructor(cellCount: number) {
    super(createCards(52), meridianLayout(cellCount));
    this.cells = this.pilesOf(PileKind.Cell);
    this.tableau = this.pilesOf(PileKind.Tableau);
    this.symmetricGroups = [[...this.cells], [...this.tableau]];
  }

  /** +1 for Sunrise piles (Ace upward), -1 for Sunset piles (King downward). */
  public direction(foundation: number): Direction {
    return foundation % 2 === 0 ? 1 : -1;
  }

  public deal(seed: number): Board {
    const board = createBoard(this.layout.piles.length);
    const deck = this.shuffledIds(seed);
    dealColumns(board, deck, this.tableau, [7, 7, 7, 7, 6, 6, 6, 6], new Array(COLUMNS).fill(0));
    return board;
  }

  /** Cards move one at a time from the top of any column or cell. */
  public canPick(board: Board, pile: number, index: number): boolean {
    const kind = this.kindOf(pile);
    return (kind === PileKind.Tableau || kind === PileKind.Cell) && index === board.piles[pile].length - 1;
  }

  public canDrop(board: Board, from: number, index: number, to: number): boolean {
    if (board.piles[from].length - index !== 1) {
      return false;
    }
    const moving = this.cardAt(board, from, index);
    const target = this.topCard(board, to);
    switch (this.kindOf(to)) {
      case PileKind.Foundation: {
        if (moving.suit !== this.layout.piles[to].suit) {
          return false;
        }
        const direction = this.direction(to);
        if (target === undefined) {
          return moving.rank === (direction === 1 ? ACE : KING);
        }
        return moving.rank === target.rank + direction;
      }
      case PileKind.Cell:
        return target === undefined;
      case PileKind.Tableau:
        return target === undefined || (target.suit === moving.suit && Math.abs(target.rank - moving.rank) === 1);
      default:
        return false;
    }
  }

  /** Each column is one same-suit chain, so the suits can simply be sent home. */
  public override canAutoFinish(board: Board): boolean {
    return this.tableau.every((pile) => {
      const cards = board.piles[pile].map((id) => this.cards[id]);
      return cards.every(
        (card, i) => i === 0 || (card.suit === cards[0].suit && Math.abs(card.rank - cards[i - 1].rank) === 1)
      );
    });
  }

  /** How many cards of a suit are home (its Sunrise plus its Sunset pile). */
  public suitProgress(board: Board, foundation: number): number {
    const rise = foundation - (foundation % 2);
    return board.piles[rise].length + board.piles[rise + 1].length;
  }

  /**
   * Any foundation play is safe: a card going onto Sunrise can only be a base
   * for the next card up, which may then follow it straight to Sunrise (and
   * symmetrically for Sunset).
   */
  public override safeAutoMove(board: Board): Move | null {
    for (const from of [...this.cells, ...this.tableau]) {
      const length = board.piles[from].length;
      if (length === 0) {
        continue;
      }
      for (let to = 0; to < FOUNDATIONS; to += 1) {
        if (this.canDrop(board, from, length - 1, to)) {
          return transfer(from, to);
        }
      }
    }
    return null;
  }

  /** Penalise burying the cards either end of each suit is waiting for. */
  public override evaluate(board: Board): number {
    const wanted = new Set<number>();
    for (let rise = 0; rise < FOUNDATIONS; rise += 2) {
      const suit = ALL_SUITS[rise / 2];
      const low = this.topCard(board, rise)?.rank ?? ACE - 1;
      const high = this.topCard(board, rise + 1)?.rank ?? KING + 1;
      if (high - low > 1) {
        wanted.add(cardId(suit, low + 1));
        wanted.add(cardId(suit, high - 1));
      }
    }
    return super.evaluate(board) - 3 * this.buriedDepth(board, (card) => wanted.has(card.id));
  }

  protected override isPointless(board: Board, from: number, index: number, to: number): boolean {
    if (super.isPointless(board, from, index, to)) {
      return true;
    }
    // Swapping a card between two equally good resting places achieves nothing.
    if (
      this.kindOf(from) === PileKind.Tableau &&
      this.kindOf(to) === PileKind.Tableau &&
      index > 0 &&
      board.piles[to].length > 0
    ) {
      const beneath = this.cardAt(board, from, index - 1);
      const moving = this.cardAt(board, from, index);
      return beneath.suit === moving.suit && Math.abs(beneath.rank - moving.rank) === 1;
    }
    return false;
  }

  protected override describeTarget(board: Board, to: number): string {
    if (this.kindOf(to) !== PileKind.Foundation) {
      return super.describeTarget(board, to);
    }
    const suit = this.layout.piles[to].suit ?? ALL_SUITS[0];
    return this.direction(to) === 1
      ? `to the ${suitSymbol(suit)} Sunrise pile`
      : `to the ${suitSymbol(suit)} Sunset pile`;
  }

  public override describeMove(board: Board, move: Move): string {
    if (move.kind === "move" && this.kindOf(move.to) === PileKind.Foundation) {
      const card = this.topCard(board, move.from);
      const top = this.topCard(board, move.to);
      const after = top ? ` after ${rankLabel(top.rank)}` : "";
      return card
        ? `Move ${cardLabel(card)} ${this.describeTarget(board, move.to)}${after}`
        : super.describeMove(board, move);
    }
    return super.describeMove(board, move);
  }
}

export const meridian: VariantDefinition = {
  id: "meridian",
  name: "Meridian",
  tagline: "Sunrise meets sunset",
  original: true,
  difficulties: {
    easy: { label: "Dawn", detail: "Three free cells" },
    medium: { label: "Noon", detail: "Two free cells" },
    hard: { label: "Dusk", detail: "A single free cell" },
  },
  tutorial: [
    {
      title: "Goal",
      text: "Meridian is an original game made for this collection. Send all 52 cards home to the foundations.",
    },
    {
      title: "Sunrise & Sunset",
      text: "Each suit has two foundations: Sunrise climbs up from the Ace, Sunset climbs down from the King. The suit is complete when they meet — anywhere in the middle!",
      highlight: [PileKind.Foundation],
    },
    {
      title: "Building",
      text: "All cards are face-up. Move one card at a time onto a card of the same suit that is one rank higher or lower: 6♥ can go on 5♥ or 7♥. Empty columns take any card.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Free cells",
      text: "Each free cell stores one card while you dig. Harder levels give you fewer cells.",
      highlight: [PileKind.Cell],
    },
    {
      title: "Tips",
      text: "For every suit, ask: is it easier to reach the low cards or the high cards? Dig towards whichever end is closer to the surface.",
    },
  ],
  theme: { table: [0xe0703a, 0x4a1a3a], accent: 0xffd180, pattern: "rays", intro: "spiral" },
  solver: { strategy: "best-first", verifyNodes: 200_000, hintNodes: 40_000 },
  createRules: (difficulty) => new MeridianRules(CELLS[difficulty]),
};
