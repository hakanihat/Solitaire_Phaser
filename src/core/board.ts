/**
 * The complete, serialisable state of a deal.
 *
 * Cards are referenced by id (index into the variant's card table). Every pile
 * is ordered bottom → top. Face-down cards always sit at the bottom of a pile,
 * so a single counter per pile (`hidden`) is enough to describe card faces.
 * This keeps boards tiny and cheap to clone, which matters for the solver.
 *
 * Boards are treated as immutable by everything outside of the rules' own
 * `apply` step, which always works on a fresh clone.
 */
export interface Board {
  readonly piles: number[][];
  readonly hidden: number[];
  /** How many times the waste has been recycled into the stock. */
  passes: number;
}

export function createBoard(pileCount: number): Board {
  return {
    piles: Array.from({ length: pileCount }, () => []),
    hidden: new Array<number>(pileCount).fill(0),
    passes: 0,
  };
}

export function cloneBoard(board: Board): Board {
  return {
    piles: board.piles.map((pile) => pile.slice()),
    hidden: board.hidden.slice(),
    passes: board.passes,
  };
}

export const topCardId = (board: Board, pile: number): number | undefined => {
  const cards = board.piles[pile];
  return cards[cards.length - 1];
};

export const isFaceUp = (board: Board, pile: number, index: number): boolean => index >= board.hidden[pile];

export const isTopFaceUp = (board: Board, pile: number): boolean => board.piles[pile].length > board.hidden[pile];

/** Moves the top `count` cards of `from` onto `to`, preserving order. */
export function transferCards(board: Board, from: number, to: number, count: number, faceUp = true): void {
  const source = board.piles[from];
  const moved = source.splice(source.length - count, count);
  board.hidden[from] = Math.min(board.hidden[from], source.length);
  board.piles[to].push(...moved);
  if (!faceUp) {
    board.hidden[to] = board.piles[to].length;
  }
}

/** Turns the top card of a pile face-up if it is face-down. Returns true on flip. */
export function revealTop(board: Board, pile: number): boolean {
  const length = board.piles[pile].length;
  if (length > 0 && board.hidden[pile] >= length) {
    board.hidden[pile] = length - 1;
    return true;
  }
  return false;
}

export interface KeyOptions {
  /** Groups of interchangeable piles (sorted so permutations share a key). */
  readonly symmetricGroups?: readonly (readonly number[])[];
  readonly includePasses?: boolean;
  /** Piles whose future depends only on their top card (e.g. a Golf waste). */
  readonly topOnly?: readonly boolean[];
}

/** Stable identity of a board, used for transposition tables and cycle checks. */
export function boardKey(board: Board, options: KeyOptions = {}): string {
  const parts = board.piles.map((pile, index) =>
    options.topOnly?.[index] === true
      ? `${pile.length > 0 ? pile[pile.length - 1] : "-"}`
      : `${board.hidden[index]}:${pile.join(",")}`
  );
  // Piles that are interchangeable under the rules (e.g. FreeCell cells) are
  // sorted so that permutations of the same position share one key.
  for (const group of options.symmetricGroups ?? []) {
    const sorted = group.map((index) => parts[index]).sort();
    group.forEach((index, i) => {
      parts[index] = sorted[i];
    });
  }
  return `${options.includePasses === false ? 0 : board.passes}|${parts.join("/")}`;
}
