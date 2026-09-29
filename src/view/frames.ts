import type * as Phaser from "phaser";
import { COLORS, hex, shade } from "./ui";

/*
 * Ornate frames for menu tiles and the "continue" card, painted once into a
 * canvas texture at native resolution. They overlay a miniature of the game's
 * own table, so every game gets a frame in its own colours.
 */

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Rim colours: the game's accent, or gold for highlighted frames. */
function rimGradient(ctx: CanvasRenderingContext2D, h: number, accent: number, gilded: boolean): CanvasGradient {
  const rim = ctx.createLinearGradient(0, 0, 0, h);
  if (gilded) {
    rim.addColorStop(0, "#fff4c2");
    rim.addColorStop(0.45, hex(COLORS.gold));
    rim.addColorStop(1, "#a8740a");
  } else {
    rim.addColorStop(0, hex(shade(accent, 0.5)));
    rim.addColorStop(0.5, hex(accent));
    rim.addColorStop(1, hex(shade(accent, -0.35)));
  }
  return rim;
}

/**
 * Paints (or reuses) a frame overlay: top sheen, bottom shade for legible
 * titles, a gradient rim, an inner filigree line and corner brackets with
 * small jewels. Returns the texture key.
 */
export function ornateFrame(
  scene: Phaser.Scene,
  id: string,
  width: number,
  height: number,
  radius: number,
  accent: number,
  gilded = false
): string {
  const w = Math.round(width);
  const h = Math.round(height);
  const key = `frame_${id}_${w}x${h}`;
  if (scene.textures.exists(key)) {
    return key;
  }
  const texture = scene.textures.createCanvas(key, w, h);
  if (!texture) {
    return key;
  }
  const ctx = texture.getContext();
  const line = Math.max(2, Math.min(w, h) * 0.022);

  // Lighting inside the frame.
  ctx.save();
  roundedPath(ctx, 0, 0, w, h, radius);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h * 0.45);
  const floor = ctx.createLinearGradient(0, h * 0.4, 0, h);
  floor.addColorStop(0, "rgba(0,0,0,0)");
  floor.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.4, w, h * 0.6);
  ctx.restore();

  const rim = rimGradient(ctx, h, accent, gilded);

  // Outer rim with a thin dark outline so it reads on light tables too.
  ctx.lineWidth = line + 2;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  roundedPath(ctx, line / 2 + 1, line / 2 + 1, w - line - 2, h - line - 2, radius);
  ctx.stroke();
  ctx.lineWidth = line;
  ctx.strokeStyle = rim;
  roundedPath(ctx, line / 2 + 1, line / 2 + 1, w - line - 2, h - line - 2, radius);
  ctx.stroke();

  // Inner filigree line.
  const inset = line * 3;
  ctx.lineWidth = Math.max(1, line * 0.4);
  ctx.strokeStyle = gilded ? "rgba(255, 228, 140, 0.55)" : "rgba(255,255,255,0.28)";
  roundedPath(ctx, inset, inset, w - inset * 2, h - inset * 2, Math.max(2, radius - inset * 0.7));
  ctx.stroke();

  // Corner brackets with a jewel at each corner.
  const arm = Math.min(w, h) * 0.16;
  const c = inset + line * 1.6;
  const corners: [number, number, number, number][] = [
    [c, c, 1, 1],
    [w - c, c, -1, 1],
    [w - c, h - c, -1, -1],
    [c, h - c, 1, -1],
  ];
  ctx.lineCap = "round";
  ctx.lineWidth = line * 0.9;
  ctx.strokeStyle = rim;
  ctx.fillStyle = rim;
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + dx * arm, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * arm);
    ctx.stroke();
    const jewel = line * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - jewel);
    ctx.lineTo(x + jewel, y);
    ctx.lineTo(x, y + jewel);
    ctx.lineTo(x - jewel, y);
    ctx.closePath();
    ctx.fill();
  }

  texture.refresh();
  return key;
}
