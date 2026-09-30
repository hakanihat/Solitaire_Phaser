import * as Phaser from "phaser";

/**
 * Most pixels the canvas may have. Phones and ordinary screens stay below it
 * and render at full physical resolution; beyond it (high-density screens in
 * fullscreen) the GPU's fill rate, not visible detail, becomes the limit.
 */
const MAX_PIXELS = 4_700_000;

/**
 * Render pixels per CSS pixel: the device pixel ratio (capped at 3), lowered
 * when needed to keep the canvas within `MAX_PIXELS`, never below 1.
 */
function fitRatio(): number {
  const device = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
  const budget = Math.sqrt(MAX_PIXELS / Math.max(1, window.innerWidth * window.innerHeight));
  return Math.max(1, Math.min(device, budget));
}

let ratio = fitRatio();

/**
 * Current render resolution per CSS pixel. The canvas is created at this
 * resolution and scaled with CSS, so cards and text stay crisp.
 */
export const renderRatio = (): number => ratio;

export const viewportSize = (): { width: number; height: number } => ({
  width: Math.round(window.innerWidth * ratio),
  height: Math.round(window.innerHeight * ratio),
});

/** Keeps the game canvas matched to the window at physical resolution. */
export function trackViewport(game: Phaser.Game): void {
  let pending: number | undefined;
  const apply = (): void => {
    ratio = fitRatio();
    const { width, height } = viewportSize();
    game.scale.resize(width, height);
    game.scale.setZoom(1 / ratio);
  };
  window.addEventListener("resize", () => {
    window.clearTimeout(pending);
    pending = window.setTimeout(apply, 80);
  });
}

/**
 * UI scale factor: 1 "UI unit" is one CSS pixel on a typical phone, grown a
 * little on tablets/desktops so controls keep a comfortable size.
 */
export function uiScale(scene: Phaser.Scene): number {
  const cssMin = Math.min(scene.scale.width, scene.scale.height) / ratio;
  return ratio * Phaser.Math.Clamp(cssMin / 390, 0.85, 1.5);
}
