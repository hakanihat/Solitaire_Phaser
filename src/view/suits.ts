import { Suit } from "../core/cards";

/*
 * Suit symbols as vector paths, so card faces and effects look the same on
 * every device (some Android fonts swap ♥ for a colour emoji) and stay sharp
 * at any size. Shapes are designed on a unit box and scaled by `r`.
 */

type Command = readonly [op: "M" | "L", x: number, y: number] | readonly [op: "C", ...points: number[]];

/** Classic heart: two round lobes meeting in a soft point. */
const HEART: readonly Command[] = [
  ["M", 0, 0.9],
  ["C", -0.35, 0.62, -1, 0.2, -1, -0.32],
  ["C", -1, -0.72, -0.72, -0.95, -0.48, -0.95],
  ["C", -0.22, -0.95, -0.06, -0.78, 0, -0.6],
  ["C", 0.06, -0.78, 0.22, -0.95, 0.48, -0.95],
  ["C", 0.72, -0.95, 1, -0.72, 1, -0.32],
  ["C", 1, 0.2, 0.35, 0.62, 0, 0.9],
];

/** An upside-down heart on a flared stem, drawn as one outline. */
const SPADE: readonly Command[] = [
  ["M", 0, -0.95],
  ["C", 0.35, -0.62, 1, -0.25, 1, 0.2],
  ["C", 1, 0.52, 0.76, 0.72, 0.5, 0.72],
  ["C", 0.3, 0.72, 0.12, 0.62, 0.05, 0.5],
  ["C", 0.07, 0.72, 0.16, 0.88, 0.36, 0.97],
  ["L", -0.36, 0.97],
  ["C", -0.16, 0.88, -0.07, 0.72, -0.05, 0.5],
  ["C", -0.12, 0.62, -0.3, 0.72, -0.5, 0.72],
  ["C", -0.76, 0.72, -1, 0.52, -1, 0.2],
  ["C", -1, -0.25, -0.35, -0.62, 0, -0.95],
];

/** Flared stem shared by the club (clockwise, like the club's circles). */
const CLUB_STEM: readonly Command[] = [
  ["M", 0.06, 0.15],
  ["C", 0.07, 0.62, 0.16, 0.86, 0.36, 0.97],
  ["L", -0.36, 0.97],
  ["C", -0.16, 0.86, -0.07, 0.62, -0.06, 0.15],
];

function trace(ctx: CanvasRenderingContext2D, path: readonly Command[], r: number): void {
  for (const [op, ...p] of path) {
    if (op === "M") {
      ctx.moveTo(p[0] * r, p[1] * r);
    } else if (op === "L") {
      ctx.lineTo(p[0] * r, p[1] * r);
    } else {
      ctx.bezierCurveTo(p[0] * r, p[1] * r, p[2] * r, p[3] * r, p[4] * r, p[5] * r);
    }
  }
  ctx.closePath();
}

/**
 * Traces a suit symbol centred on (0, 0), about `2r` tall. The caller
 * fills (and optionally strokes) the path.
 */
export function traceSuit(ctx: CanvasRenderingContext2D, suit: Suit, r: number): void {
  ctx.beginPath();
  switch (suit) {
    case Suit.Hearts:
      trace(ctx, HEART, r);
      break;
    case Suit.Spades:
      trace(ctx, SPADE, r);
      break;
    case Suit.Diamonds:
      ctx.moveTo(0, -0.97 * r);
      ctx.quadraticCurveTo(0.3 * r, -0.45 * r, 0.74 * r, 0);
      ctx.quadraticCurveTo(0.3 * r, 0.45 * r, 0, 0.97 * r);
      ctx.quadraticCurveTo(-0.3 * r, 0.45 * r, -0.74 * r, 0);
      ctx.quadraticCurveTo(-0.3 * r, -0.45 * r, 0, -0.97 * r);
      ctx.closePath();
      break;
    case Suit.Clubs:
      for (const [x, y] of [
        [0, -0.5],
        [-0.5, 0.1],
        [0.5, 0.1],
        [0, -0.02],
      ]) {
        const radius = y === -0.02 ? 0.22 : 0.37;
        ctx.moveTo((x + radius) * r, y * r);
        ctx.arc(x * r, y * r, radius * r, 0, Math.PI * 2);
      }
      trace(ctx, CLUB_STEM, r);
      break;
  }
}
