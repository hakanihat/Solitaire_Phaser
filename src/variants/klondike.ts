import { type Board, createBoard, transferCards } from "../core/board";
import { alternateColorsDown, foundationRanks, isRun, isSafeForAlternatingColors } from "../core/building";
import { createCards, KING } from "../core/cards";
import { Fan, type Layout, PileKind } from "../core/layout";
import { type Move, transfer } from "../core/moves";
import { type Difficulty, Rules } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import {
  COLUMN_STEP,
  TABLEAU_TOP,
  canDropOnFoundation,
  dealColumns,
  foundationFor,
  foundationRow,
  layoutWidth,
  pileSpec,
  tableauRow,
} from "./common";

interface KlondikeOptions {
  readonly draw: number;
  /** Total passes through the stock; Infinity for unlimited redeals. */
  readonly passes: number;
}

const OPTIONS: Record<Difficulty, KlondikeOptions> = {
  easy: { draw: 1, passes: Infinity },
  medium: { draw: 3, passes: Infinity },
  hard: { draw: 3, passes: 3 },
};

const STOCK = 0;
const WASTE = 1;

function klondikeLayout(draw: number): Layout {
  return {
    width: layoutWidth(7),
    height: TABLEAU_TOP + 1,
    piles: [
      pileSpec(PileKind.Stock, 6 * COLUMN_STEP, 0),
      pileSpec(PileKind.Waste, 5 * COLUMN_STEP, 0, { fan: Fan.Left, fanLimit: draw }),
      ...foundationRow(4, 0),
      ...tableauRow(7, TABLEAU_TOP, 0, "K"),
    ],
  };
}

export class KlondikeRules extends Rules {
  public override readonly symmetricGroups: number[][];
  protected override readonly passesMatter: boolean;
  private readonly tableau: readonly number[];
  private readonly foundations: readonly number[];

  public constructor(private readonly options: KlondikeOptions) {
    super(createCards(52), klondikeLayout(options.draw));
    this.tableau = this.pilesOf(PileKind.Tableau);
    this.foundations = this.pilesOf(PileKind.Foundation);
    this.symmetricGroups = [[...this.tableau], [...this.foundations]];
    this.passesMatter = Number.isFinite(options.passes);
  }

  public deal(seed: number): Board {
    const board = createBoard(this.layout.piles.length);
    const deck = this.shuffledIds(seed);
    dealColumns(board, deck, this.tableau, [1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6]);
    board.piles[STOCK].push(...deck);
    board.hidden[STOCK] = deck.length;
    return board;
  }

  public canPick(board: Board, pile: number, index: number): boolean {
    const length = board.piles[pile].length;
    switch (this.kindOf(pile)) {
      case PileKind.Waste:
      case PileKind.Foundation:
        return index === length - 1;
      case PileKind.Tableau:
        return index >= board.hidden[pile] && isRun(this, board, pile, index, alternateColorsDown);
      default:
        return false;
    }
  }

  public canDrop(board: Board, from: number, index: number, to: number): boolean {
    const moving = this.cardAt(board, from, index);
    switch (this.kindOf(to)) {
      case PileKind.Foundation:
        return canDropOnFoundation(this, board, from, index, to);
      case PileKind.Tableau: {
        const target = this.topCard(board, to);
        return target === undefined ? moving.rank === KING : alternateColorsDown(target, moving);
      }
      default:
        return false;
    }
  }

  public override canDraw(board: Board): boolean {
    return board.piles[STOCK].length > 0 || (board.piles[WASTE].length > 0 && board.passes < this.options.passes - 1);
  }

  protected override performDraw(board: Board): void {
    const stock = board.piles[STOCK];
    if (stock.length === 0) {
      stock.push(...board.piles[WASTE].reverse());
      board.piles[WASTE].length = 0;
      board.hidden[STOCK] = stock.length;
      board.passes += 1;
      return;
    }
    const count = Math.min(this.options.draw, stock.length);
    for (let i = 0; i < count; i += 1) {
      transferCards(board, STOCK, WASTE, 1);
    }
  }

  public override evaluate(board: Board): number {
    const ranks = foundationRanks(this, board, this.foundations);
    return super.evaluate(board) - 3 * this.buriedDepth(board, (card) => card.rank === ranks[card.suit] + 1);
  }

  public override safeAutoMove(board: Board): Move | null {
    const ranks = foundationRanks(this, board, this.foundations);
    for (const from of [WASTE, ...this.tableau]) {
      const to = foundationFor(this, board, from);
      const card = this.topCard(board, from);
      if (to !== undefined && card && isSafeForAlternatingColors(card, ranks)) {
        return transfer(from, to);
      }
    }
    return null;
  }

  /** Classic Klondike auto-complete: once every tableau card is face-up. */
  public override canAutoFinish(board: Board): boolean {
    return this.tableau.every((pile) => board.hidden[pile] === 0);
  }

  protected override isPointless(board: Board, from: number, index: number, to: number): boolean {
    if (super.isPointless(board, from, index, to)) {
      return true;
    }
    // Splitting a face-up run between columns only helps if it frees the
    // card underneath for a foundation.
    if (this.kindOf(from) === PileKind.Tableau && this.kindOf(to) === PileKind.Tableau && index > board.hidden[from]) {
      const beneath = this.cardAt(board, from, index - 1);
      const ranks = foundationRanks(this, board, this.foundations);
      return ranks[beneath.suit] !== beneath.rank - 1;
    }
    // A foundation card only comes back down if it is needed as a base, which
    // the solver never needs to consider for safely-played cards.
    if (this.kindOf(from) === PileKind.Foundation) {
      const card = this.cardAt(board, from, index);
      return isSafeForAlternatingColors(card, foundationRanks(this, board, this.foundations));
    }
    return false;
  }
}

export const klondike: VariantDefinition = {
  id: "klondike",
  name: "Klondike",
  tagline: "The timeless classic",
  difficulties: {
    easy: { label: "Draw 1", detail: "Turn one card at a time, unlimited passes" },
    medium: { label: "Draw 3", detail: "Turn three cards at a time, unlimited passes" },
    hard: { label: "Draw 3 · 3 passes", detail: "Three cards at a time, only three passes through the deck" },
  },
  tutorial: [
    {
      title: "Goal",
      text: "Move all 52 cards to the four foundations, building each suit up from Ace to King.",
      highlight: [PileKind.Foundation],
    },
    {
      title: "The tableau",
      text: "Build columns down in alternating colours — a red 6 on a black 7. Move whole face-up runs together. Face-down cards flip over when uncovered.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Empty columns",
      text: "Only a King (with any run on it) can move into an empty column, so empty spaces are precious.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Stock & waste",
      text: "Tap the stock to turn cards onto the waste. The top waste card can be played. When the stock runs out, tap it again to recycle the waste.",
      highlight: [PileKind.Stock, PileKind.Waste],
    },
    {
      title: "Tips",
      text: "Uncover face-down cards early, and don't rush cards to the foundation if you still need them to build on. Every deal here is guaranteed winnable!",
    },
  ],
  theme: {
    table: [0x1f7a4d, 0x0b3d24],
    accent: 0xffd166,
    pattern: "felt",
    ambient: "motes",
    intro: "fan",
    emblem: "goldRush",
  },
  solver: { strategy: "best-first", verifyNodes: 150_000, hintNodes: 30_000 },
  createRules: (difficulty) => new KlondikeRules(OPTIONS[difficulty]),
};
