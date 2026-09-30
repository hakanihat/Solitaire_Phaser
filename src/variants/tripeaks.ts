import { type Board, transferCards } from "../core/board";
import { createCards } from "../core/cards";
import { type Layout, PileKind } from "../core/layout";
import type { Difficulty } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import { COLUMN_STEP, pileSpec } from "./common";
import { ROW_STEP, SLOT_STEP, type SlotNode, nodesBottom, slotSpecs } from "./overlap";
import { ChainRules } from "./peaks";

interface PeaksOptions {
  readonly open: boolean;
  readonly wrap: boolean;
}

const OPTIONS: Record<Difficulty, PeaksOptions> = {
  easy: { open: true, wrap: true },
  medium: { open: false, wrap: true },
  hard: { open: false, wrap: false },
};

/**
 * Three peaks over a shared base: rows of 3, 6, 9 and 10 cards. Row centres
 * are expressed in half-card steps so each card rests on the two below it.
 */
function peaksNodes(): SlotNode[] {
  const rows: number[][] = [
    [1.5, 4.5, 7.5],
    [1, 2, 4, 5, 7, 8],
    Array.from({ length: 9 }, (_, i) => i + 0.5),
    Array.from({ length: 10 }, (_, i) => i),
  ];
  const firstIndex = [0, 3, 9, 18];
  const nodes: SlotNode[] = [];
  rows.forEach((centres, row) => {
    centres.forEach((centre) => {
      const below = rows[row + 1] ?? [];
      const coveredBy = below
        .map((c, i) => (Math.abs(c - centre) === 0.5 ? firstIndex[row + 1] + i : -1))
        .filter((index) => index >= 0);
      nodes.push({ cx: centre * SLOT_STEP + 0.5, cy: row * ROW_STEP + 0.5, coveredBy });
    });
  });
  return nodes;
}

const NODES = peaksNodes();
const STOCK = NODES.length;
const WASTE = NODES.length + 1;

function peaksLayout(): Layout {
  const width = 9 * SLOT_STEP + 1;
  const bottomY = nodesBottom(NODES) + 0.3;
  const wasteX = width / 2 - 0.5 + COLUMN_STEP * 0.6;
  return {
    width,
    height: bottomY + 1,
    piles: [
      ...slotSpecs(NODES),
      pileSpec(PileKind.Stock, wasteX - COLUMN_STEP * 1.3, bottomY),
      pileSpec(PileKind.Waste, wasteX, bottomY),
    ],
  };
}

export class TriPeaksRules extends ChainRules {
  protected readonly wrap: boolean;

  public constructor(options: PeaksOptions) {
    super(createCards(52), peaksLayout(), NODES, options.open);
    this.wrap = options.wrap;
  }

  public deal(seed: number): Board {
    const { board, rest } = this.dealSlots(seed);
    board.piles[STOCK].push(...rest);
    board.hidden[STOCK] = rest.length;
    transferCards(board, STOCK, WASTE, 1);
    return board;
  }

  protected override performDraw(board: Board): void {
    transferCards(board, STOCK, WASTE, 1);
  }
}

export const tripeaks: VariantDefinition = {
  id: "tripeaks",
  name: "TriPeaks",
  tagline: "Chain cards up and down",
  difficulties: {
    easy: { label: "Open", detail: "All cards face-up, King ↔ Ace wraps" },
    medium: { label: "Classic", detail: "Hidden cards, King ↔ Ace wraps" },
    hard: { label: "No wrap", detail: "Hidden cards, no wrapping between King and Ace" },
  },
  tutorial: [
    {
      title: "Goal",
      text: "Clear all three peaks by moving every card onto the waste pile.",
      highlight: [PileKind.Slot],
    },
    {
      title: "Chains",
      text: "Tap an uncovered card that is one rank higher or lower than the waste card — a 7 goes on a 6 or an 8, any suit. King and Ace connect on easier levels.",
      highlight: [PileKind.Slot, PileKind.Waste],
    },
    {
      title: "Combos",
      text: "Every card you play in a row without drawing raises your combo multiplier. Long chains score big!",
    },
    {
      title: "Stock",
      text: "Stuck? Tap the stock to turn a new card onto the waste. It breaks your combo, and the stock only goes through once.",
      highlight: [PileKind.Stock],
    },
    {
      title: "Tips",
      text: "When two cards fit, pick the one that uncovers a face-down card or keeps the chain going longer.",
    },
  ],
  theme: {
    table: [0x2f6fb0, 0x0e2748],
    accent: 0x9be7ff,
    pattern: "hexagons",
    ambient: "snow",
    intro: "peaks",
    emblem: "peaks",
  },
  solver: { strategy: "best-first", verifyNodes: 200_000, hintNodes: 40_000 },
  createRules: (difficulty) => new TriPeaksRules(OPTIONS[difficulty]),
};
