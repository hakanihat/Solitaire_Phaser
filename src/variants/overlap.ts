import { type Board, createBoard } from "../core/board";
import type { Card } from "../core/cards";
import { type Layout, PileKind, type PileSpec } from "../core/layout";
import type { Move } from "../core/moves";
import { Rules } from "../core/Rules";
import { pileSpec } from "./common";

/** One card position in an overlapping layout. */
export interface SlotNode {
  /** Centre of the card, in card units. */
  readonly cx: number;
  readonly cy: number;
  /** Slots that lie on top of this one and must be cleared first. */
  readonly coveredBy: readonly number[];
}

/** Vertical distance between overlapping rows, in card heights. */
export const ROW_STEP = 0.42;
/** Horizontal distance between neighbouring cards in a row, in card widths. */
export const SLOT_STEP = 1.06;

/**
 * A pyramid of `rows` rows whose apex is at (`apexX`, 0). Slot (r, i) is
 * covered by (r + 1, i) and (r + 1, i + 1).
 */
export function pyramidNodes(rows: number, apexX: number, indexOffset = 0): SlotNode[] {
  const nodes: SlotNode[] = [];
  const indexOf = (row: number, i: number): number => indexOffset + (row * (row + 1)) / 2 + i;
  for (let row = 0; row < rows; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      nodes.push({
        cx: apexX + (i - row / 2) * SLOT_STEP,
        cy: row * ROW_STEP + 0.5,
        coveredBy: row < rows - 1 ? [indexOf(row + 1, i), indexOf(row + 1, i + 1)] : [],
      });
    }
  }
  return nodes;
}

export const slotSpecs = (nodes: readonly SlotNode[]): PileSpec[] =>
  nodes.map((node, index) => pileSpec(PileKind.Slot, node.cx - 0.5, node.cy - 0.5, { hideWhenEmpty: true, z: index }));

export const nodesBottom = (nodes: readonly SlotNode[]): number => Math.max(...nodes.map((node) => node.cy + 0.5));

/**
 * Shared behaviour of games played on overlapping cards (Pyramid, TriPeaks,
 * Gemini): a card is available once every card covering it has been removed,
 * covered cards may be dealt face-down, and progress is measured by how much
 * of the layout has been cleared.
 */
export abstract class OverlapRules extends Rules {
  protected readonly slots: readonly number[];

  protected constructor(
    cards: readonly Card[],
    layout: Layout,
    private readonly nodes: readonly SlotNode[],
    /** Deal covered cards face-up (open information, easier). */
    private readonly open: boolean
  ) {
    super(cards, layout);
    this.slots = this.pilesOf(PileKind.Slot);
  }

  public isAvailable(board: Board, slot: number): boolean {
    return board.piles[slot].length > 0 && this.nodes[slot].coveredBy.every((cover) => board.piles[cover].length === 0);
  }

  public override progress(board: Board): number {
    return this.slots.reduce((sum, slot) => sum + (board.piles[slot].length === 0 ? 1 : 0), 0);
  }

  public override goal(): number {
    return this.slots.length;
  }

  /** Deals one card per slot and returns the rest of the shuffled deck. */
  protected dealSlots(seed: number): { board: Board; rest: number[] } {
    const board = createBoard(this.layout.piles.length);
    const deck = this.shuffledIds(seed);
    for (const slot of this.slots) {
      board.piles[slot].push(deck.shift() as number);
      board.hidden[slot] = this.open || this.nodes[slot].coveredBy.length === 0 ? 0 : 1;
    }
    return { board, rest: deck };
  }

  protected override afterMove(board: Board, _move: Move): void {
    for (const slot of this.slots) {
      if (board.hidden[slot] > 0 && this.isAvailable(board, slot)) {
        board.hidden[slot] = 0;
      }
    }
  }
}
