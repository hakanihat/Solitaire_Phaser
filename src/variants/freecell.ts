import { type Board, createBoard } from "../core/board";
import { alternateColorsDown, foundationRanks, isRun, isSafeForAlternatingColors } from "../core/building";
import { createCards } from "../core/cards";
import { type Layout, PileKind } from "../core/layout";
import { type Move, transfer } from "../core/moves";
import { type Difficulty, Rules } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import {
  COLUMN_STEP,
  TABLEAU_TOP,
  canDropOnFoundation,
  dealColumns,
  foundationFor,
  layoutWidth,
  pileSpec,
  tableauRow,
} from "./common";

const CELLS: Record<Difficulty, number> = { easy: 4, medium: 4, hard: 3 };
const COLUMNS = 8;

function freeCellLayout(cells: number): Layout {
  return {
    width: layoutWidth(COLUMNS),
    height: TABLEAU_TOP + 1,
    piles: [
      ...Array.from({ length: cells }, (_, i) => pileSpec(PileKind.Cell, i * COLUMN_STEP, 0)),
      ...Array.from({ length: 4 }, (_, i) =>
        pileSpec(PileKind.Foundation, (COLUMNS - 4 + i) * COLUMN_STEP, 0, { placeholder: "A" })
      ),
      ...tableauRow(COLUMNS, TABLEAU_TOP),
    ],
  };
}

export class FreeCellRules extends Rules {
  public override readonly symmetricGroups: number[][];
  private readonly cells: readonly number[];
  private readonly tableau: readonly number[];
  private readonly foundations: readonly number[];

  public constructor(cellCount: number) {
    super(createCards(52), freeCellLayout(cellCount));
    this.cells = this.pilesOf(PileKind.Cell);
    this.tableau = this.pilesOf(PileKind.Tableau);
    this.foundations = this.pilesOf(PileKind.Foundation);
    this.symmetricGroups = [[...this.cells], [...this.tableau], [...this.foundations]];
  }

  public deal(seed: number): Board {
    const board = createBoard(this.layout.piles.length);
    const deck = this.shuffledIds(seed);
    dealColumns(board, deck, this.tableau, [7, 7, 7, 7, 6, 6, 6, 6], new Array(COLUMNS).fill(0));
    return board;
  }

  /**
   * How many cards can move as a unit ("supermove"): each free cell doubles
   * as a temporary spot, and each empty column doubles the whole capacity.
   */
  public capacity(board: Board, toEmptyColumn: boolean): number {
    const freeCells = this.cells.filter((cell) => board.piles[cell].length === 0).length;
    const emptyColumns = this.tableau.filter((pile) => board.piles[pile].length === 0).length;
    return (freeCells + 1) * 2 ** Math.max(0, emptyColumns - (toEmptyColumn ? 1 : 0));
  }

  public canPick(board: Board, pile: number, index: number): boolean {
    const count = board.piles[pile].length - index;
    switch (this.kindOf(pile)) {
      case PileKind.Cell:
      case PileKind.Foundation:
        return count === 1;
      case PileKind.Tableau:
        return count <= this.capacity(board, false) && isRun(this, board, pile, index, alternateColorsDown);
      default:
        return false;
    }
  }

  public canDrop(board: Board, from: number, index: number, to: number): boolean {
    const count = board.piles[from].length - index;
    switch (this.kindOf(to)) {
      case PileKind.Foundation:
        return canDropOnFoundation(this, board, from, index, to);
      case PileKind.Cell:
        return count === 1 && board.piles[to].length === 0;
      case PileKind.Tableau: {
        const target = this.topCard(board, to);
        if (count > this.capacity(board, target === undefined)) {
          return false;
        }
        return target === undefined || alternateColorsDown(target, this.cardAt(board, from, index));
      }
      default:
        return false;
    }
  }

  public override evaluate(board: Board): number {
    const ranks = foundationRanks(this, board, this.foundations);
    return super.evaluate(board) - 3 * this.buriedDepth(board, (card) => card.rank === ranks[card.suit] + 1);
  }

  /** Every column already in alternating-colour order: the rest is mechanical. */
  public override canAutoFinish(board: Board): boolean {
    return this.tableau.every((pile) => isRun(this, board, pile, 0, alternateColorsDown));
  }

  public override safeAutoMove(board: Board): Move | null {
    const ranks = foundationRanks(this, board, this.foundations);
    for (const from of [...this.cells, ...this.tableau]) {
      const to = foundationFor(this, board, from);
      const card = this.topCard(board, from);
      if (to !== undefined && card && isSafeForAlternatingColors(card, ranks)) {
        return transfer(from, to);
      }
    }
    return null;
  }

  protected override isPointless(board: Board, from: number, index: number, to: number): boolean {
    if (super.isPointless(board, from, index, to)) {
      return true;
    }
    const fromKind = this.kindOf(from);
    const toKind = this.kindOf(to);
    if (fromKind === PileKind.Foundation) {
      return isSafeForAlternatingColors(
        this.cardAt(board, from, index),
        foundationRanks(this, board, this.foundations)
      );
    }
    // Moving a run off a card it already legally sits on, onto another
    // equivalent card, achieves nothing unless it frees a foundation card.
    if (fromKind === PileKind.Tableau && toKind === PileKind.Tableau && index > 0 && board.piles[to].length > 0) {
      const beneath = this.cardAt(board, from, index - 1);
      if (alternateColorsDown(beneath, this.cardAt(board, from, index))) {
        return foundationRanks(this, board, this.foundations)[beneath.suit] !== beneath.rank - 1;
      }
    }
    return false;
  }
}

export const freecell: VariantDefinition = {
  id: "freecell",
  name: "FreeCell",
  tagline: "Every card in sight",
  difficulties: {
    easy: { label: "Relaxed", detail: "Four free cells and a gentle deal" },
    medium: { label: "Classic", detail: "Four free cells" },
    hard: { label: "Three cells", detail: "Only three free cells to work with" },
  },
  tutorial: [
    {
      title: "Goal",
      text: "Move all cards to the four foundations, building each suit from Ace up to King. Every card is face-up, so it's all about planning.",
      highlight: [PileKind.Foundation],
    },
    {
      title: "Building",
      text: "In the tableau, build down in alternating colours: a black 9 on a red 10.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Free cells",
      text: "Each free cell holds any one card. Use them to dig out buried cards — but a full set of cells leaves you stuck.",
      highlight: [PileKind.Cell],
    },
    {
      title: "Moving runs",
      text: "You can move a whole run at once if you have enough empty cells and columns to shuffle it card by card. Empty columns accept any card.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Tips",
      text: "Free the Aces and Twos first and keep at least one cell open. An empty column is worth more than a free cell.",
    },
  ],
  theme: {
    table: [0x157a7a, 0x063434],
    accent: 0x7ff3e1,
    pattern: "diamonds",
    ambient: "bubbles",
    intro: "cascade",
    emblem: "undersea",
  },
  solver: { strategy: "best-first", verifyNodes: 200_000, hintNodes: 40_000, effort: { easy: { maxNodes: 150 } } },
  createRules: (difficulty) => new FreeCellRules(CELLS[difficulty]),
};
