import { type Board, createBoard, transferCards } from "../core/board";
import { adjacentRank } from "../core/building";
import { cardLabel, createCards, KING } from "../core/cards";
import { type Layout, PileKind } from "../core/layout";
import { type Move, drawMove, transfer } from "../core/moves";
import { type Difficulty, Rules } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import { COLUMN_STEP, TABLEAU_TOP, dealColumns, layoutWidth, pileSpec, tableauRow } from "./common";

interface GolfOptions {
  readonly wrap: boolean;
  /** Classic strict rule: nothing may be played on a King. */
  readonly kingBlocks: boolean;
}

const OPTIONS: Record<Difficulty, GolfOptions> = {
  easy: { wrap: true, kingBlocks: false },
  medium: { wrap: false, kingBlocks: false },
  hard: { wrap: false, kingBlocks: true },
};

const STOCK = 0;
const WASTE = 1;
const COLUMNS = 7;
const CARDS_PER_COLUMN = 5;
const TABLEAU_CARDS = COLUMNS * CARDS_PER_COLUMN;

function golfLayout(): Layout {
  return {
    width: layoutWidth(COLUMNS),
    height: TABLEAU_TOP + 1,
    piles: [
      pileSpec(PileKind.Stock, 0, 0),
      pileSpec(PileKind.Waste, COLUMN_STEP, 0),
      ...tableauRow(COLUMNS, TABLEAU_TOP),
    ],
  };
}

export class GolfRules extends Rules {
  public override readonly comboScoring = true;
  /** Only the top card of the waste can ever be built on again. */
  protected override readonly topOnlyKinds = [PileKind.Waste];
  private readonly tableau: readonly number[];

  public constructor(private readonly options: GolfOptions) {
    super(createCards(52), golfLayout());
    this.tableau = this.pilesOf(PileKind.Tableau);
  }

  public deal(seed: number): Board {
    const board = createBoard(this.layout.piles.length);
    const deck = this.shuffledIds(seed);
    dealColumns(board, deck, this.tableau, new Array(COLUMNS).fill(CARDS_PER_COLUMN), new Array(COLUMNS).fill(0));
    board.piles[STOCK].push(...deck);
    board.hidden[STOCK] = deck.length;
    transferCards(board, STOCK, WASTE, 1);
    return board;
  }

  public canPick(board: Board, pile: number, index: number): boolean {
    return this.kindOf(pile) === PileKind.Tableau && index === board.piles[pile].length - 1;
  }

  public canDrop(board: Board, from: number, index: number, to: number): boolean {
    const top = this.topCard(board, to);
    if (to !== WASTE || top === undefined || (this.options.kingBlocks && top.rank === KING)) {
      return false;
    }
    return adjacentRank(top.rank, this.cardAt(board, from, index).rank, this.options.wrap);
  }

  public override canDraw(board: Board): boolean {
    return board.piles[STOCK].length > 0;
  }

  protected override performDraw(board: Board): void {
    transferCards(board, STOCK, WASTE, 1);
  }

  /** Once the stock is exhausted every remaining play is forced or not. */
  public override canAutoFinish(board: Board): boolean {
    return board.piles[STOCK].length === 0;
  }

  public override progress(board: Board): number {
    return TABLEAU_CARDS - this.tableau.reduce((sum, pile) => sum + board.piles[pile].length, 0);
  }

  public override goal(): number {
    return TABLEAU_CARDS;
  }

  /** Cleared cards are progress; unused stock cards are a resource. */
  public override evaluate(board: Board): number {
    return super.evaluate(board) + board.piles[STOCK].length * 8;
  }

  public override usefulMoves(board: Board): Move[] {
    const moves: Move[] = this.tableau
      .filter((pile) => board.piles[pile].length > 0 && this.canDrop(board, pile, board.piles[pile].length - 1, WASTE))
      .map((pile) => transfer(pile, WASTE));
    if (this.canDraw(board)) {
      moves.push(drawMove);
    }
    return moves;
  }

  /** Prefer plays from tall columns, and plays that allow another play. */
  public override moveHeuristic(board: Board, move: Move): number {
    if (move.kind !== "move") {
      return 0;
    }
    const after = this.apply(board, move);
    const followUps = this.usefulMoves(after).filter((next) => next.kind === "move").length;
    return 20 + board.piles[move.from].length * 3 + followUps * 5;
  }

  public override describeMove(board: Board, move: Move): string {
    if (move.kind === "move") {
      const card = this.topCard(board, move.from);
      const waste = this.topCard(board, WASTE);
      return card && waste ? `Play ${cardLabel(card)} onto ${cardLabel(waste)}` : "Play onto the waste";
    }
    return move.kind === "draw" ? "Turn a new card from the stock" : super.describeMove(board, move);
  }
}

export const golf: VariantDefinition = {
  id: "golf",
  name: "Golf",
  tagline: "One rank up or down",
  difficulties: {
    easy: { label: "Wrap", detail: "King ↔ Ace wraps around" },
    medium: { label: "Classic", detail: "No wrapping between King and Ace" },
    hard: { label: "Strict", detail: "No wrapping, and nothing can be played on a King" },
  },
  tutorial: [
    {
      title: "Goal",
      text: "Clear all seven columns by moving every card onto the waste pile.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Playing cards",
      text: "Tap the bottom card of any column if it is one rank higher or lower than the waste card, regardless of suit.",
      highlight: [PileKind.Tableau, PileKind.Waste],
    },
    {
      title: "Stock",
      text: "When nothing fits, tap the stock to turn a new card onto the waste. The stock goes through only once.",
      highlight: [PileKind.Stock],
    },
    {
      title: "Tips",
      text: "Plan runs that go up and down (5-6-5-4) and save stock cards for when you really need them. Combos score more!",
    },
  ],
  theme: {
    table: [0x7cb342, 0x2e5c14],
    accent: 0xfff59d,
    pattern: "stripes",
    ambient: "petals",
    intro: "columns",
    emblem: "golf",
  },
  solver: { strategy: "best-first", verifyNodes: 200_000, hintNodes: 40_000 },
  createRules: (difficulty) => new GolfRules(OPTIONS[difficulty]),
};
