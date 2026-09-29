import { type Card, isRed } from "../core/cards";
import { traceSuit } from "./suits";

/*
 * Card faces painted as vectors at the exact size they are shown, in the
 * style of the original artwork (white card, soft grey panel, big corner
 * index, suit top-right and a large centre rank). Drawing instead of
 * scaling a bitmap keeps every face sharp on any screen, and lets the
 * corner index grow on small cards, where it is all a fanned column shows.
 */

/** Font used for ranks; loaded in BootScene. Montserrat, SIL OFL 1.1. */
export const CARD_FONT = "CardFace";
export const CARD_FONT_FILE = "assets/fonts/montserrat.woff2";
const FONT_STACK = `${CARD_FONT}, "Segoe UI", Roboto, Arial, sans-serif`;
/** Capital height as a fraction of the font size (Montserrat ≈ 0.70). */
const CAP_HEIGHT = 0.7;

const RANK_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

/** Vertical ink gradients, as in the original art. */
const INK = {
  red: ["#f81010", "#a00000"],
  black: ["#333c44", "#07080a"],
} as const;

/** Card widths (device pixels) between which the index scales up. */
const SMALL_CARD = 64;
const LARGE_CARD = 120;

interface FaceMetrics {
  readonly indexCap: number;
  readonly indexWeight: number;
  readonly indexTop: number;
  readonly indexLeft: number;
  readonly suitRadius: number;
  readonly centreCap: number;
}

function faceMetrics(w: number, h: number): FaceMetrics {
  // 1 on small cards, 0 on large ones.
  const small = Math.min(1, Math.max(0, (LARGE_CARD - w) / (LARGE_CARD - SMALL_CARD)));
  const indexCap = h * (0.15 + 0.035 * small);
  return {
    indexCap,
    indexWeight: Math.round(700 + 100 * small),
    indexTop: h * (0.05 - 0.012 * small),
    indexLeft: w * (0.08 - 0.02 * small),
    suitRadius: indexCap * 0.66,
    centreCap: h * 0.4,
  };
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

function inkGradient(ctx: CanvasRenderingContext2D, red: boolean, top: number, bottom: number): CanvasGradient {
  const [from, to] = red ? INK.red : INK.black;
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  return gradient;
}

/**
 * Draws `label` with its capitals spanning `top`..`top + cap`, starting at
 * `x` (or centred on it), squeezed horizontally if wider than `maxWidth`.
 */
function drawRank(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  top: number,
  cap: number,
  weight: number,
  maxWidth: number,
  align: "left" | "center"
): void {
  ctx.font = `${weight} ${cap / CAP_HEIGHT}px ${FONT_STACK}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const width = ctx.measureText(label).width;
  const squeeze = Math.min(1, maxWidth / width);
  ctx.save();
  ctx.translate(align === "center" ? x - (width * squeeze) / 2 : x, top + cap);
  ctx.scale(squeeze, 1);
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

/** Paints one card face into the `w` × `h` box at (x, y). */
export function paintCardFace(
  ctx: CanvasRenderingContext2D,
  card: Pick<Card, "suit" | "rank">,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const red = isRed(card.suit);
  const m = faceMetrics(w, h);
  const label = RANK_LABELS[card.rank];

  ctx.save();
  ctx.translate(x, y);

  // Card stock with a hairline edge, so stacked cards stay separate.
  roundedRect(ctx, 0, 0, w, h, radius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  const edge = Math.max(1, w * 0.006);
  roundedRect(ctx, edge / 2, edge / 2, w - edge, h - edge, radius - edge / 2);
  ctx.lineWidth = edge;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
  ctx.stroke();

  // Inner panel, lit from above.
  const inset = w * 0.065;
  const panelTop = w * 0.05;
  const panelBottom = h - w * 0.075;
  const panel = ctx.createLinearGradient(0, panelTop, 0, panelBottom);
  panel.addColorStop(0, "#ffffff");
  panel.addColorStop(0.35, "#f6f6f6");
  panel.addColorStop(1, "#e2e2e2");
  roundedRect(ctx, inset, panelTop, w - inset * 2, panelBottom - panelTop, radius * 0.8);
  ctx.fillStyle = panel;
  ctx.fill();

  // Corner index: rank top-left, suit top-right.
  ctx.fillStyle = inkGradient(ctx, red, m.indexTop, m.indexTop + m.indexCap);
  drawRank(ctx, label, m.indexLeft, m.indexTop, m.indexCap, m.indexWeight, w * 0.5, "left");
  ctx.save();
  ctx.translate(w - m.indexLeft - m.suitRadius * 0.95, m.indexTop + m.indexCap / 2);
  traceSuit(ctx, card.suit, m.suitRadius);
  ctx.fillStyle = inkGradient(ctx, red, -m.suitRadius, m.suitRadius);
  ctx.fill();
  ctx.restore();

  // Large centre rank.
  const centreTop = h * 0.63 - m.centreCap / 2;
  ctx.fillStyle = inkGradient(ctx, red, centreTop, centreTop + m.centreCap);
  drawRank(ctx, label, w / 2, centreTop, m.centreCap, 660, w * 0.74, "center");

  ctx.restore();
}
