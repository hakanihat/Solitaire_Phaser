/**
 * Every player action is one of these. Moves are plain data so they can be
 * stored in solver paths, compared, and replayed by the autoplay system.
 */
export type Move =
  /** Move the top `count` cards of pile `from` onto pile `to`. */
  | { readonly kind: "move"; readonly from: number; readonly to: number; readonly count: number }
  /** Use the stock: deal, draw or recycle depending on the variant. */
  | { readonly kind: "draw" }
  /** Discard the top cards of two piles together (Pyramid). */
  | { readonly kind: "pair"; readonly a: number; readonly b: number };

export const drawMove: Move = { kind: "draw" };

export const transfer = (from: number, to: number, count = 1): Move => ({
  kind: "move",
  from,
  to,
  count,
});

export function sameMove(a: Move, b: Move): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  switch (a.kind) {
    case "draw":
      return true;
    case "move":
      return b.kind === "move" && a.from === b.from && a.to === b.to && a.count === b.count;
    case "pair":
      return b.kind === "pair" && ((a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a));
  }
}

/*
 * Compact text encoding of move lists, used to ship each pre-verified deal
 * together with its solution: one character per pile index / count, "~" for
 * a stock action and "!" for a pair.
 */
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DRAW = "~";
const PAIR = "!";

const encodeIndex = (value: number): string => {
  if (value < 0 || value >= ALPHABET.length) {
    throw new RangeError(`Cannot encode ${value}`);
  }
  return ALPHABET[value];
};

export function encodeMoves(moves: readonly Move[]): string {
  return moves
    .map((move) => {
      switch (move.kind) {
        case "draw":
          return DRAW;
        case "pair":
          return PAIR + encodeIndex(move.a) + encodeIndex(move.b);
        case "move":
          return encodeIndex(move.from) + encodeIndex(move.to) + encodeIndex(move.count);
      }
    })
    .join("");
}

export function decodeMoves(text: string): Move[] {
  const moves: Move[] = [];
  const read = (at: number): number => {
    const value = ALPHABET.indexOf(text[at]);
    if (value < 0) {
      throw new SyntaxError(`Bad move encoding at ${at}`);
    }
    return value;
  };
  for (let i = 0; i < text.length;) {
    if (text[i] === DRAW) {
      moves.push(drawMove);
      i += 1;
    } else if (text[i] === PAIR) {
      moves.push({ kind: "pair", a: read(i + 1), b: read(i + 2) });
      i += 3;
    } else {
      moves.push(transfer(read(i), read(i + 1), read(i + 2)));
      i += 3;
    }
  }
  return moves;
}
