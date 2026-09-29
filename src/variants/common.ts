import { type Board, transferCards } from "../core/board";
import { canBuildFoundation, isRun, sameSuitDown } from "../core/building";
import { KING, RANKS_PER_SUIT } from "../core/cards";
import { Fan, PileKind, type PileSpec } from "../core/layout";
import type { Rules } from "../core/Rules";

/** Horizontal distance between neighbouring columns, in card widths. */
export const COLUMN_STEP = 1.12;
/** Vertical position of the tableau when there is a row of piles above it. */
export const TABLEAU_TOP = 1.22;

export const pileSpec = (kind: PileKind, x: number, y: number, extra: Partial<PileSpec> = {}): PileSpec => ({
  kind,
  x,
  y,
  fan: Fan.None,
  ...extra,
});

/** A row of fanned-down tableau columns starting at column `firstColumn`. */
export const tableauRow = (count: number, y: number, firstColumn = 0, placeholder?: string): PileSpec[] =>
  Array.from({ length: count }, (_, i) =>
    pileSpec(PileKind.Tableau, (firstColumn + i) * COLUMN_STEP, y, { fan: Fan.Down, placeholder })
  );

export const foundationRow = (count: number, y: number, firstColumn = 0): PileSpec[] =>
  Array.from({ length: count }, (_, i) =>
    pileSpec(PileKind.Foundation, (firstColumn + i) * COLUMN_STEP, y, { placeholder: "A" })
  );

export const layoutWidth = (columns: number): number => (columns - 1) * COLUMN_STEP + 1;

/** Shared foundation drop rule: a single card, Ace first, then same suit up. */
export function canDropOnFoundation(rules: Rules, board: Board, from: number, index: number, to: number): boolean {
  return (
    board.piles[from].length - index === 1 &&
    canBuildFoundation(rules.topCard(board, to), rules.cardAt(board, from, index))
  );
}

/** Deals `counts[i]` cards to pile `piles[i]`, with `hidden[i]` of them face-down. */
export function dealColumns(
  board: Board,
  deck: number[],
  piles: readonly number[],
  counts: readonly number[],
  hidden: readonly number[]
): void {
  piles.forEach((pile, i) => {
    board.piles[pile].push(...deck.splice(0, counts[i]));
    board.hidden[pile] = hidden[i];
  });
}

/** Finds a foundation that accepts the top card of `from`, if any. */
export function foundationFor(rules: Rules, board: Board, from: number): number | undefined {
  const length = board.piles[from].length;
  if (length === 0 || length <= board.hidden[from]) {
    return undefined;
  }
  return rules.pilesOf(PileKind.Foundation).find((to) => rules.canDrop(board, from, length - 1, to));
}

/**
 * Moves every completed King → Ace same-suit run sitting on top of a tableau
 * column to an empty foundation (Spider, Scorpion).
 */
export function collectCompletedRuns(
  rules: Rules,
  board: Board,
  tableau: readonly number[],
  foundations: readonly number[]
): void {
  for (const pile of tableau) {
    const cards = board.piles[pile];
    const start = cards.length - RANKS_PER_SUIT;
    if (start < board.hidden[pile] || rules.cardAt(board, pile, start).rank !== KING) {
      continue;
    }
    if (!isRun(rules, board, pile, start, sameSuitDown)) {
      continue;
    }
    const target = foundations.find((f) => board.piles[f].length === 0);
    if (target !== undefined) {
      transferCards(board, pile, target, RANKS_PER_SUIT);
    }
  }
}
