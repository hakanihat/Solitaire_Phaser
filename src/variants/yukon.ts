import { type Board, createBoard } from "../core/board";
import {
  type Relation,
  alternateColorsDown,
  foundationRanks,
  isRun,
  isSafeForAlternatingColors,
  sameSuitDown,
} from "../core/building";
import { createCards, KING } from "../core/cards";
import { type Layout, PileKind } from "../core/layout";
import { type Move, transfer } from "../core/moves";
import { Rules } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import {
  TABLEAU_TOP,
  canDropOnFoundation,
  dealColumns,
  foundationFor,
  foundationRow,
  layoutWidth,
  tableauRow,
} from "./common";

const COLUMNS = 7;

function yukonLayout(): Layout {
  return {
    width: layoutWidth(COLUMNS),
    height: TABLEAU_TOP + 1,
    piles: [...foundationRow(4, 0, COLUMNS - 4), ...tableauRow(COLUMNS, TABLEAU_TOP, 0, "K")],
  };
}

/**
 * Yukon: no stock at all, and any face-up card can be moved together with
 * whatever lies on top of it — the cards above do not need to be in sequence.
 * Russian Solitaire (the hard level) is the same game built in suit.
 */
export class YukonRules extends Rules {
  public override readonly symmetricGroups: number[][];
  private readonly tableau: readonly number[];
  private readonly foundations: readonly number[];

  public constructor(private readonly relation: Relation) {
    super(createCards(52), yukonLayout());
    this.tableau = this.pilesOf(PileKind.Tableau);
    this.foundations = this.pilesOf(PileKind.Foundation);
    this.symmetricGroups = [[...this.tableau], [...this.foundations]];
  }

  public deal(seed: number): Board {
    const board = createBoard(this.layout.piles.length);
    const deck = this.shuffledIds(seed);
    const hidden = [0, 1, 2, 3, 4, 5, 6];
    dealColumns(
      board,
      deck,
      this.tableau,
      hidden.map((h, i) => (i === 0 ? 1 : h + 5)),
      hidden
    );
    return board;
  }

  public canPick(board: Board, pile: number, index: number): boolean {
    switch (this.kindOf(pile)) {
      case PileKind.Tableau:
        return index >= board.hidden[pile];
      case PileKind.Foundation:
        return index === board.piles[pile].length - 1;
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
        return target === undefined ? moving.rank === KING : this.relation(target, moving);
      }
      default:
        return false;
    }
  }

  /** Everything face-up and every column in building order. */
  public override canAutoFinish(board: Board): boolean {
    return this.tableau.every((pile) => board.hidden[pile] === 0 && isRun(this, board, pile, 0, this.relation));
  }

  private get inSuit(): boolean {
    return this.relation === sameSuitDown;
  }

  /**
   * With alternate colours the usual "both opposite suits are high enough"
   * test applies. Built in suit, a card is only ever a base for its own suit's
   * next lower card, which is already home — so foundation plays are always safe.
   */
  private isSafe(board: Board, from: number): boolean {
    const card = this.topCard(board, from);
    return (
      card !== undefined &&
      (this.inSuit || isSafeForAlternatingColors(card, foundationRanks(this, board, this.foundations)))
    );
  }

  public override evaluate(board: Board): number {
    const ranks = foundationRanks(this, board, this.foundations);
    return super.evaluate(board) - 3 * this.buriedDepth(board, (card) => card.rank === ranks[card.suit] + 1);
  }

  public override safeAutoMove(board: Board): Move | null {
    for (const from of this.tableau) {
      const to = foundationFor(this, board, from);
      if (to !== undefined && this.isSafe(board, from)) {
        return transfer(from, to);
      }
    }
    return null;
  }

  protected override isPointless(board: Board, from: number, index: number, to: number): boolean {
    if (super.isPointless(board, from, index, to)) {
      return true;
    }
    if (this.kindOf(from) === PileKind.Foundation) {
      return true;
    }
    // A card already resting on a legal base only needs to move if that frees
    // a card beneath it for the foundation.
    if (index > board.hidden[from] && this.kindOf(to) === PileKind.Tableau) {
      const beneath = this.cardAt(board, from, index - 1);
      if (this.relation(beneath, this.cardAt(board, from, index))) {
        return foundationRanks(this, board, this.foundations)[beneath.suit] !== beneath.rank - 1;
      }
    }
    return false;
  }
}

export const yukon: VariantDefinition = {
  id: "yukon",
  name: "Yukon",
  tagline: "Move any face-up card",
  difficulties: {
    easy: { label: "Gentle", detail: "Alternate colours, with an easier deal" },
    medium: { label: "Classic", detail: "Build down in alternate colours" },
    hard: { label: "Russian", detail: "Build down in the same suit only" },
  },
  tutorial: [
    {
      title: "Goal",
      text: "Move every card to the foundations, building each suit up from Ace to King.",
      highlight: [PileKind.Foundation],
    },
    {
      title: "Free movement",
      text: "Any face-up card can be moved — together with every card on top of it — even if those cards aren't in order. The card you grab just has to fit where it lands.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Building",
      text: "Place a card on the next higher card of the opposite colour (same suit in Russian mode). Only Kings go into empty columns.",
      highlight: [PileKind.Tableau],
    },
    {
      title: "Tips",
      text: "There is no stock — everything is already on the table. Focus on uncovering face-down cards in the tall columns on the right.",
    },
  ],
  theme: { table: [0x3b6e8f, 0x13283a], accent: 0xb3e5fc, pattern: "scales", ambient: "snow", intro: "columns" },
  solver: { strategy: "best-first", verifyNodes: 200_000, hintNodes: 40_000, effort: { easy: { maxNodes: 120 } } },
  createRules: (difficulty) => new YukonRules(difficulty === "hard" ? sameSuitDown : alternateColorsDown),
};
