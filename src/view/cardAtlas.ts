import * as Phaser from "phaser";
import { CARD_ASPECT, CARD_SHEET, CARD_TEXTURE } from "./CardView";

/** A card sheet pre-rendered at the size the cards are shown on screen. */
export interface CardAtlas {
  readonly key: string;
  /** Card size inside each frame, in pixels. */
  readonly width: number;
  readonly height: number;
  /** Transparent margin around each card that holds its shadow. */
  readonly pad: number;
}

const ATLAS_PREFIX = "cards_atlas_";
/** Menu, loading screen and game each use their own size. */
const MAX_ATLASES = 4;
const recent: string[] = [];
/** Atlas grid; 8 × 7 = 56 cells keeps the texture roughly square. */
const COLUMNS = 8;
const ROWS = 7;

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Halves the sheet repeatedly until it is at most twice the target scale.
 * Scaling in ×0.5 steps is what keeps thin strokes and big numerals clean;
 * one large GPU minification (no mipmaps for this texture) shimmers when
 * cards move.
 */
function downscaledSheet(sheet: HTMLImageElement | HTMLCanvasElement, targetScale: number): HTMLCanvasElement {
  let source: HTMLImageElement | HTMLCanvasElement = sheet;
  let scale = 1;
  while (scale / 2 >= targetScale * 1.5) {
    scale /= 2;
    const next = makeCanvas(sheet.width * scale, sheet.height * scale);
    const ctx = next.getContext("2d") as CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, next.width, next.height);
    source = next;
  }
  if (source instanceof HTMLCanvasElement) {
    return source;
  }
  const copy = makeCanvas(sheet.width, sheet.height);
  (copy.getContext("2d") as CanvasRenderingContext2D).drawImage(source, 0, 0);
  return copy;
}

/**
 * Renders every card face (and the back) at exactly `width` × `height`
 * pixels, each with a soft drop shadow baked in, into one texture. Cards
 * then draw 1:1 — crisp, cheap on fill-rate, and all in a single batch.
 * Frame numbers match the original sheet, so `frameOf()` works unchanged.
 */
export function buildCardAtlas(scene: Phaser.Scene, cardWidth: number, cardHeight: number): CardAtlas {
  const width = Math.max(8, Math.round(cardWidth));
  const height = Math.max(8, Math.round(cardHeight));
  const pad = Math.ceil(width * 0.1);
  const key = `${ATLAS_PREFIX}${width}x${height}`;
  const atlas: CardAtlas = { key, width, height, pad };
  if (scene.textures.exists(key)) {
    return atlas;
  }

  const sheet = scene.textures.get(CARD_TEXTURE).getSourceImage() as HTMLImageElement;
  const frameW = sheet.width / CARD_SHEET.columns;
  const scaled = downscaledSheet(sheet, width / frameW);
  const ratio = scaled.width / sheet.width;
  const cellW = width + pad * 2;
  const cellH = height + pad * 2;
  const texture = scene.textures.createCanvas(key, cellW * COLUMNS, cellH * ROWS);
  if (!texture) {
    return atlas;
  }
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const radius = width * 0.045;

  const frames = CARD_SHEET.columns * CARD_SHEET.rows;
  for (let frame = 0; frame < frames; frame += 1) {
    const x = (frame % COLUMNS) * cellW + pad;
    const y = Math.floor(frame / COLUMNS) * cellH + pad;
    // Shadow first, from a slightly inset shape so no dark rim shows.
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
    ctx.shadowBlur = pad * 0.85;
    ctx.shadowOffsetY = pad * 0.3;
    ctx.fillStyle = "#000";
    roundedRect(ctx, x + 1, y + 1, width - 2, height - 2, radius);
    ctx.fill();
    ctx.restore();
    const sx = (frame % CARD_SHEET.columns) * frameW * ratio;
    const sy = Math.floor(frame / CARD_SHEET.columns) * (sheet.height / CARD_SHEET.rows) * ratio;
    ctx.drawImage(scaled, sx, sy, frameW * ratio, (sheet.height / CARD_SHEET.rows) * ratio, x, y, width, height);
    texture.add(frame, 0, x - pad, y - pad, cellW, cellH);
  }
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

  // Keep only the most recent few sizes (menu, loading screen, game).
  recent.push(key);
  while (recent.length > MAX_ATLASES) {
    const stale = recent.shift() as string;
    scene.time.delayedCall(0, () => scene.textures.remove(stale));
  }
  return atlas;
}

/** A crisp card image `width` pixels wide, drawn from a matching atlas. */
export function cardImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  frame: number,
  width: number
): Phaser.GameObjects.Image {
  const atlas = buildCardAtlas(scene, width, width * CARD_ASPECT);
  return scene.add.image(x, y, atlas.key, frame).setScale(width / atlas.width);
}
