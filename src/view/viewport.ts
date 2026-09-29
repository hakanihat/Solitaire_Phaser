import * as Phaser from "phaser";

/**
 * Device pixel ratio used for rendering. The canvas is created at physical
 * resolution and scaled down with CSS, so cards and text stay crisp on
 * high-density phone screens. Capped at 3 to bound GPU memory.
 */
export const DPR = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);

export const viewportSize = (): { width: number; height: number } => ({
  width: Math.round(window.innerWidth * DPR),
  height: Math.round(window.innerHeight * DPR),
});

/** Keeps the game canvas matched to the window at physical resolution. */
export function trackViewport(game: Phaser.Game): void {
  let pending: number | undefined;
  const apply = (): void => {
    const { width, height } = viewportSize();
    game.scale.resize(width, height);
    game.scale.setZoom(1 / DPR);
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
  const cssMin = Math.min(scene.scale.width, scene.scale.height) / DPR;
  return DPR * Phaser.Math.Clamp(cssMin / 390, 0.85, 1.5);
}
