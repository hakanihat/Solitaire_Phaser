import { type Board, transferCards } from "../core/board";
import { cardLabel, createCards } from "../core/cards";
import { type Layout, PileKind } from "../core/layout";
import type { Move } from "../core/moves";
import type { Difficulty } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import { COLUMN_STEP, pileSpec } from "./common";
import { SLOT_STEP, nodesBottom, pyramidNodes, slotSpecs } from "./overlap";
import { ChainRules } from "./peaks";

/*
 * GEMINI — an original solitaire designed for this collection.
 *
 * Two pyramids of 15 cards stand side by side. Below them lie two waste piles,
 * the Sun and the Moon. Any uncovered card may be played onto either twin if
 * it is one rank above or below that twin's top card. Tapping the stock deals
 * a fresh card onto *both* twins at once.
 *
 * Design intent: TriPeaks is fun but often comes down to luck because there is
 * only one chain. With two chains the player constantly decides which twin to
 * extend and can "park" a rank on one twin for later, which adds planning
 * without adding rules to memorise.
 */

interface GeminiOptions {
  readonly open: boolean;
  readonly wrap: boolean;
}

const OPTIONS: Record<Difficulty, GeminiOptions> = {
  easy: { open: true, wrap: true },
  medium: { open: false, wrap: true },
  hard: { open: false, wrap: false },
};

const ROWS = 5;
const PER_PYRAMID = (ROWS * (ROWS + 1)) / 2;
const GAP = 0.35;
const LEFT_APEX = 2 * SLOT_STEP + 0.5;
const RIGHT_APEX = LEFT_APEX + 5 * SLOT_STEP + GAP;
const NODES = [...pyramidNodes(ROWS, LEFT_APEX), ...pyramidNodes(ROWS, RIGHT_APEX, PER_PYRAMID)];
const STOCK = NODES.length;
const SUN = NODES.length + 1;
const MOON = NODES.length + 2;

/** Tall screens: the Moon pyramid sits below the Sun pyramid. */
function geminiPortraitLayout(): Layout {
  const apex = 2 * SLOT_STEP + 0.5;
  const upper = pyramidNodes(ROWS, apex);
  const shift = nodesBottom(upper) + 0.25;
  const lower = pyramidNodes(ROWS, apex, PER_PYRAMID).map((node) => ({ ...node, cy: node.cy + shift }));
  const nodes = [...upper, ...lower];
  const width = 4 * SLOT_STEP + 1;
  const bottomY = nodesBottom(nodes) + 0.3;
  const centre = width / 2 - 0.5;
  return {
    width,
    height: bottomY + 1,
    piles: [
      ...slotSpecs(nodes),
      pileSpec(PileKind.Stock, centre, bottomY),
      pileSpec(PileKind.Waste, centre - COLUMN_STEP * 1.6, bottomY, { placeholder: "☀" }),
      pileSpec(PileKind.Waste, centre + COLUMN_STEP * 1.6, bottomY, { placeholder: "☾" }),
    ],
  };
}

function geminiLayout(): Layout {
  const width = RIGHT_APEX + 2 * SLOT_STEP + 0.5;
  const bottomY = nodesBottom(NODES) + 0.3;
  const centre = width / 2 - 0.5;
  return {
    width,
    height: bottomY + 1,
    portrait: geminiPortraitLayout(),
    piles: [
      ...slotSpecs(NODES),
      pileSpec(PileKind.Stock, centre, bottomY),
      pileSpec(PileKind.Waste, centre - COLUMN_STEP * 1.6, bottomY, { placeholder: "☀" }),
      pileSpec(PileKind.Waste, centre + COLUMN_STEP * 1.6, bottomY, { placeholder: "☾" }),
    ],
  };
}

export class GeminiRules extends ChainRules {
  protected readonly wrap: boolean;

  public constructor(options: GeminiOptions) {
    super(createCards(52), geminiLayout(), NODES, options.open);
    this.wrap = options.wrap;
  }

  public deal(seed: number): Board {
    const { board, rest } = this.dealSlots(seed);
    board.piles[STOCK].push(...rest);
    board.hidden[STOCK] = rest.length;
    this.performDraw(board);
    return board;
  }

  /** The stock feeds both twins at once. */
  protected override performDraw(board: Board): void {
    for (const twin of [SUN, MOON]) {
      if (board.piles[STOCK].length > 0) {
        transferCards(board, STOCK, twin, 1);
      }
    }
  }

  public override describeMove(board: Board, move: Move): string {
    if (move.kind === "move") {
      const card = this.topCard(board, move.from);
      const twin = move.to === SUN ? "the Sun ☀" : "the Moon ☾";
      return card ? `Play ${cardLabel(card)} onto ${twin}` : `Play onto ${twin}`;
    }
    return move.kind === "draw" ? "Deal a new card onto both twins" : super.describeMove(board, move);
  }
}

export const gemini: VariantDefinition = {
  id: "gemini",
  name: "Gemini",
  tagline: "Two pyramids, two chains",
  original: true,
  difficulties: {
    easy: { label: "Open", detail: "All cards face-up, King ↔ Ace wraps" },
    medium: { label: "Starlit", detail: "Hidden cards, King ↔ Ace wraps" },
    hard: { label: "Eclipse", detail: "Hidden cards, no wrapping" },
  },
  tutorial: [
    {
      title: "Goal",
      text: "Clear both pyramids. Gemini is an original game made for this collection!",
      highlight: [PileKind.Slot],
    },
    {
      title: "Twin chains",
      text: "Below the pyramids are two waste piles — the Sun ☀ and the Moon ☾. Play any uncovered card onto either twin if it's one rank higher or lower than that twin's top card.",
      highlight: [PileKind.Waste],
    },
    {
      title: "Choose wisely",
      text: "Drag a card to pick its twin, or tap it to play on the first twin that fits. Keeping two different ranks on top gives you more options next turn.",
      highlight: [PileKind.Waste, PileKind.Slot],
    },
    {
      title: "Stock",
      text: "Tapping the stock deals a new card onto both twins at once and resets your combo. Use it only when you're truly stuck.",
      highlight: [PileKind.Stock],
    },
    {
      title: "Tips",
      text: "Before playing, check whether the other twin could take the next card. A chain that alternates between twins can clear a whole pyramid!",
    },
  ],
  theme: { table: [0x40307a, 0x120b2e], accent: 0xc9a8ff, pattern: "stars", ambient: "twinkle", intro: "twins" },
  solver: { strategy: "best-first", verifyNodes: 200_000, hintNodes: 40_000 },
  createRules: (difficulty) => new GeminiRules(OPTIONS[difficulty]),
};
