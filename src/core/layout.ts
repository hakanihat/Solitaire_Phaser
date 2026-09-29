import type { Suit } from "./cards";

export enum PileKind {
  Stock = "stock",
  Waste = "waste",
  Foundation = "foundation",
  Tableau = "tableau",
  Cell = "cell",
  /** A single overlapping position in a Pyramid / Peaks style layout. */
  Slot = "slot",
}

export enum Fan {
  None = "none",
  Down = "down",
  Right = "right",
  Left = "left",
}

/**
 * Where and how a pile is drawn. Coordinates are expressed in *card units*:
 * `x` in card widths and `y` in card heights, measured to the pile's top-left
 * corner. The renderer converts units to pixels for whatever screen it runs on,
 * so variants never deal with pixels or aspect ratios.
 */
export interface PileSpec {
  readonly kind: PileKind;
  readonly x: number;
  readonly y: number;
  readonly fan: Fan;
  /** For horizontally fanned piles, only the top N cards are spread out. */
  readonly fanLimit?: number;
  /** Faint text on the empty placeholder, e.g. "A" or "K". */
  readonly placeholder?: string;
  /** Hides the empty placeholder outline (used by Pyramid / Peaks slots). */
  readonly hideWhenEmpty?: boolean;
  /** Render order for overlapping layouts; higher is drawn on top. */
  readonly z?: number;
  readonly suit?: Suit;
}

export interface Layout {
  readonly piles: readonly PileSpec[];
  /** Total width in card units, used to fit the layout to the screen. */
  readonly width: number;
  /**
   * Height in card units that must be visible without fanning (top rows plus
   * one card of each fanned column). The renderer reserves the rest of the
   * screen for fanned tableau cards.
   */
  readonly height: number;
  /**
   * Optional arrangement for tall screens. Pile indices and rules are the
   * same; the renderer uses whichever layout gives the bigger cards.
   */
  readonly portrait?: Layout;
}

/** Mirrors a layout horizontally, used for the left-handed option. */
export function mirrorLayout(layout: Layout): Layout {
  return {
    ...layout,
    portrait: layout.portrait ? mirrorLayout(layout.portrait) : undefined,
    piles: layout.piles.map((pile) => ({
      ...pile,
      x: layout.width - pile.x - 1,
      fan: pile.fan === Fan.Right ? Fan.Left : pile.fan === Fan.Left ? Fan.Right : pile.fan,
    })),
  };
}
