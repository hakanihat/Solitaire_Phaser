import { type Board, createBoard, transferCards } from "../core/board";
import { isRun, sameSuitDown } from "../core/building";
import { createCards, KING } from "../core/cards";
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

interface ScorpionOptions {
  /** Deal every card face-up. */
  readonly open: boolean;
  /** Allow any card (not only Kings) into an empty column. */
  readonly anyToEmpty: boolean;
}

const OPTIONS: Record<Difficulty, ScorpionOptions> = {
  easy: { open: true, anyToEmpty: true },
  medium: { open: false, anyToEmpty: false },
  hard: { open: false, anyToEmpty: false },
};

const COLUMNS = 7;
const STOCK = 0;
/** The stock's three cards go onto the first three columns. */
const STOCK_TARGETS = 3;

function scorpionLayout(): Layout {
  return {
    width: layoutWidth(COLUMNS),
    height: TABLEAU_TOP + 1,
    piles: [
      pileSpec(PileKind.Stock, 0, 0),
      ...Array.from({ length: 4 }, (_, i) => pileSpec(PileKind.Foundation, (COLUMNS - 4 + i) * COLUMN_STEP, 0)),
      ...tableauRow(COLUMNS, TABLEAU_TOP, 0),
    ],
  };
}

export class ScorpionRules extends Rules {
  public override readonly symmetricGroups: number[][];
  private readonly tableau: readonly number[];
  private readonly foundations: readonly number[];

  public constructor(private readonly options: ScorpionOptions) {
    super(createCards(52), scorpionLayout());
    this.tableau = this.pilesOf(PileKind.Tableau);
    this.foundations = this.pilesOf(PileKind.Foundation);
    this.symmetricGroups = [[...this.foundations]];
  }

  public deal(seed: number): Board {
    const board = createBoard(this.layout.piles.length);
    const deck = this.shuffledIds(seed);
    const hidden = this.tableau.map((_, i) => (!this.options.open && i < 4 ? 3 : 0));
    dealColumns(board, deck, this.tableau, new Array(COLUMNS).fill(7), hidden);
    board.piles[STOCK].push(...deck);
    board.hidden[STOCK] = deck.length;
    return board;
  }

  public canPick(board: Board, pile: number, index: number): boolean {
    return this.kindOf(pile) === PileKind.Tableau && index >= board.hidden[pile];
  }

  public canDrop(board: Board, from: number, index: number, to: number): boolean {
    if (this.kindOf(to) !== PileKind.Tableau) {
      return false;
    }
    const moving = this.cardAt(board, from, index);
    const target = this.topCard(board, to);
    if (target === undefined) {
      return this.options.anyToEmpty || moving.rank === KING;
    }
    return sameSuitDown(target, moving);
  }

  /** Stock dealt, everything face-up and every column a same-suit run. */
  public override canAutoFinish(board: Board): boolean {
    return (
      board.piles[STOCK].length === 0 &&
      this.tableau.every((pile) => board.hidden[pile] === 0 && isRun(this, board, pile, 0, sameSuitDown))
    );
  }

  public override canDraw(board: Board): boolean {
    return board.piles[STOCK].length > 0;
  }

  protected override performDraw(board: Board): void {
    this.tableau.slice(0, STOCK_TARGETS).forEach((pile) => {
      if (board.piles[STOCK].length > 0) {
        transferCards(board, STOCK, pile, 1);
      }
    });
  }

  protected override afterMove(board: Board, move: Move): void {
    collectCompletedRuns(this, board, this.tableau, this.foundations);
    super.afterMove(board, move);
  }

  public override describeMove(board: Board, move: Move): string {
    return move.kind === "draw" ? "Deal the last three cards" : super.describeMove(board, move);
  }
}

export const scorpion: VariantDefinition = {
  id: "scorpion",
  name: "Scorpion",
  tagline: "Untangle the suits",
  difficulties: {
    easy: { label: "Open", detail: "All cards face-up, any card into empty columns" },
    medium: { label: "Classic", detail: "Face-down cards, only Kings into empty columns" },
    hard: { label: "Venom", detail: "Classic rules with a trickier deal" },
  },
  tutorial: [
    {
      title: "Goal",
      text: "Build four complete runs from King down to Ace, each in one suit. Finished runs move to the foundations automatically.",
      highlight: [PileKind.Foundation],
    },
    {
      title: "Moving cards",
      text: "Grab any face-up card — everything on top of it comes along. Drop it on the next higher card of the same suit: 7♠ on 8♠.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Empty columns",
      text: "Only a King can fill an empty column on the Classic level.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "The stock",
      text: "Three cards wait in the stock. Tap it once to deal them onto the first three columns — pick your moment!",
      highlight: [PileKind.Stock],
    },
  ],
  theme: { table: [0x8e3b2f, 0x2e0f0b], accent: 0xffab40, pattern: "waves", intro: "grid" },
  solver: { strategy: "depth-first", verifyNodes: 200_000, hintNodes: 40_000, effort: { hard: { minNodes: 500 } } },
  createRules: (difficulty) => new ScorpionRules(OPTIONS[difficulty]),
};
