import type { VariantTheme } from "../core/variant";

export interface IntroSlot {
  /** Position relative to the intro's centre, in card widths. */
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

const row = (count: number, y: number, step = 1.1, angle = 0): IntroSlot[] =>
  Array.from({ length: count }, (_, i) => ({ x: (i - (count - 1) / 2) * step, y, angle }));

const pyramid = (rows: number, offsetX = 0, step = 1.08): IntroSlot[] =>
  Array.from({ length: rows }, (_, r) =>
    row(r + 1, (r - (rows - 1) / 2) * 0.62, step).map((slot) => ({ ...slot, x: slot.x + offsetX }))
  ).flat();

/**
 * Card arrangements for each game's loading screen. Every game gets its own
 * little piece of choreography that hints at how its table looks.
 */
export const INTROS: Record<VariantTheme["intro"], () => IntroSlot[]> = {
  fan: () =>
    Array.from({ length: 9 }, (_, i) => {
      const t = (i - 4) / 4;
      return { x: t * 2.6, y: t * t * 0.7, angle: t * 38 };
    }),
  pyramid: () => pyramid(4),
  peaks: () => [-2.6, 0, 2.6].flatMap((cx) => pyramid(2, cx, 1.04).map((slot) => ({ ...slot, y: slot.y + 0.1 }))),
  cascade: () =>
    [-1.5, -0.5, 0.5, 1.5].flatMap((cx, c) =>
      Array.from({ length: 3 }, (_, i) => ({ x: cx * 1.15, y: (i - 1) * 0.42 + c * 0.12 - 0.2, angle: 0 }))
    ),
  spiral: () =>
    Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return { x: Math.cos(a) * 2.3, y: Math.sin(a) * 1.75, angle: (a * 180) / Math.PI + 90 };
    }),
  twins: () => [...pyramid(3, -1.9, 1.02), ...pyramid(3, 1.9, 1.02)],
  grid: () => [-0.75, 0, 0.75].flatMap((y) => row(4, y * 1.2, 1.15)),
  columns: () =>
    [-2, -1, 0, 1, 2].flatMap((cx) =>
      Array.from({ length: 3 }, (_, i) => ({ x: cx * 1.12, y: (i - 1) * 0.45, angle: 0 }))
    ),
};
