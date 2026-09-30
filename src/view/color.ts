/** CSS colour string from a 0xRRGGBB number and alpha. */
export const rgba = (color: number, alpha = 1): string =>
  `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;
