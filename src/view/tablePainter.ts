import type * as Phaser from "phaser";
import { createRng, type Rng } from "../core/random";
import type { Pattern, VariantTheme } from "../core/variant";

/** CSS colour string from a 0xRRGGBB number and alpha. */
export const rgba = (color: number, alpha = 1): string =>
  `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;

type PatternPainter = (ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, unit: number) => void;

/*
 * Each motif is drawn in white at low opacity over the gradient, so it tints
 * naturally with the variant's palette. `unit` scales motifs with the screen.
 */
const PATTERNS: Record<Pattern, PatternPainter> = {
  felt(ctx, w, h, rng, unit) {
    const dots = Math.floor((w * h) / (unit * unit) / 2);
    for (let i = 0; i < dots; i += 1) {
      ctx.fillStyle = rng() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(rng() * w, rng() * h, unit * 0.18, unit * 0.18);
    }
  },
  diamonds(ctx, w, h, _rng, unit) {
    const size = unit * 9;
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = unit * 0.25;
    for (let x = -h; x < w + h; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.moveTo(x + h, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  },
  waves(ctx, w, h, _rng, unit) {
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = unit * 0.3;
    for (let y = 0; y < h + unit * 6; y += unit * 5) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += unit) {
        const yy = y + Math.sin(x / (unit * 4)) * unit * 1.4;
        if (x === 0) {
          ctx.moveTo(x, yy);
        } else {
          ctx.lineTo(x, yy);
        }
      }
      ctx.stroke();
    }
  },
  rays(ctx, w, h, _rng, _unit) {
    const cx = w / 2;
    const cy = -h * 0.08;
    const radius = Math.hypot(w, h) * 1.2;
    const count = 28;
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < count; i += 2) {
      const a0 = (i / count) * Math.PI * 2;
      const a1 = ((i + 1) / count) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
      ctx.lineTo(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius);
      ctx.closePath();
      ctx.fill();
    }
  },
  hexagons(ctx, w, h, _rng, unit) {
    const r = unit * 4;
    const dx = r * Math.sqrt(3);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = unit * 0.25;
    for (let row = 0, y = 0; y < h + r * 2; row += 1, y += r * 1.5) {
      for (let x = row % 2 === 0 ? 0 : dx / 2; x < w + dx; x += dx) {
        ctx.beginPath();
        for (let k = 0; k < 6; k += 1) {
          const angle = Math.PI / 6 + (k * Math.PI) / 3;
          ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  },
  dots(ctx, w, h, _rng, unit) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let y = 0; y < h; y += unit * 5) {
      for (let x = (y / (unit * 5)) % 2 === 0 ? 0 : unit * 2.5; x < w; x += unit * 5) {
        ctx.beginPath();
        ctx.arc(x, y, unit * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  stripes(ctx, w, h, _rng, unit) {
    // Mown-lawn stripes for Golf.
    const band = unit * 12;
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = 0; x < w; x += band * 2) {
      ctx.fillRect(x, 0, band, h);
    }
  },
  stars(ctx, w, h, rng, unit) {
    const count = Math.floor((w * h) / (unit * unit * 30));
    for (let i = 0; i < count; i += 1) {
      const size = rng() < 0.08 ? unit * 0.45 : unit * 0.18;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + rng() * 0.45})`;
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, size, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  web(ctx, w, h, _rng, unit) {
    // A spider web anchored in the top-left corner.
    const spokes = 11;
    const radius = Math.hypot(w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = unit * 0.22;
    for (let i = 0; i <= spokes; i += 1) {
      const angle = (i / spokes) * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.stroke();
    }
    for (let r = unit * 8; r < radius; r *= 1.28) {
      ctx.beginPath();
      for (let i = 0; i <= spokes; i += 1) {
        const angle = (i / spokes) * (Math.PI / 2);
        const sag = i % 2 === 0 ? 1 : 0.94;
        ctx.lineTo(Math.cos(angle) * r * sag, Math.sin(angle) * r * sag);
      }
      ctx.stroke();
    }
  },
  bricks(ctx, w, h, _rng, unit) {
    // Sandstone blocks for Pyramid.
    const bw = unit * 12;
    const bh = unit * 5;
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = unit * 0.25;
    for (let row = 0, y = 0; y < h; row += 1, y += bh) {
      for (let x = row % 2 === 0 ? 0 : -bw / 2; x < w; x += bw) {
        ctx.strokeRect(x, y, bw, bh);
      }
    }
  },
  scales(ctx, w, h, _rng, unit) {
    const r = unit * 3.2;
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = unit * 0.22;
    for (let row = 0, y = 0; y < h + r; row += 1, y += r) {
      for (let x = row % 2 === 0 ? 0 : r; x < w + r * 2; x += r * 2) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI);
        ctx.stroke();
      }
    }
  },
};

/**
 * Paints (or re-uses) a full-screen table texture for a theme and returns its
 * key. Layers: radial gradient → motif → vignette.
 */
export interface TableOptions {
  /** Round the corners (menu tiles). */
  readonly cornerRadius?: number;
  /** Draw the decorative inset frame with suit ornaments (full-screen tables). */
  readonly frame?: boolean;
}

const SUIT_ORNAMENTS = ["♠", "♥", "♣", "♦"];

export function paintTable(
  scene: Phaser.Scene,
  theme: VariantTheme,
  id: string,
  width: number,
  height: number,
  options: TableOptions = {}
): string {
  const key = `table_${id}_${Math.round(width)}x${Math.round(height)}`;
  if (scene.textures.exists(key)) {
    return key;
  }
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    return key;
  }
  const ctx = texture.getContext();
  const unit = Math.min(width, height) / 90;
  const rng = createRng(width ^ height);
  if (options.cornerRadius) {
    roundedClip(ctx, width, height, options.cornerRadius);
  }

  // 1. Base: a soft radial gradient, lit from slightly above centre.
  const glow = ctx.createRadialGradient(
    width / 2,
    height * 0.38,
    0,
    width / 2,
    height * 0.38,
    Math.hypot(width, height) * 0.65
  );
  glow.addColorStop(0, rgba(theme.table[0]));
  glow.addColorStop(1, rgba(theme.table[1]));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 2. The game's own motif, and a fine grain so large areas never look flat.
  PATTERNS[theme.pattern](ctx, width, height, rng, unit);
  if (theme.pattern !== "felt") {
    PATTERNS.felt(ctx, width, height, rng, unit * 1.6);
  }

  // 3. A gentle spotlight where the cards are.
  const spot = ctx.createRadialGradient(
    width / 2,
    height * 0.3,
    0,
    width / 2,
    height * 0.3,
    Math.max(width, height) * 0.55
  );
  spot.addColorStop(0, "rgba(255,255,255,0.07)");
  spot.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, width, height);

  // 4. Vignette.
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.hypot(width, height) * 0.6
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  if (options.frame) {
    paintFrame(ctx, width, height, unit, theme.accent);
  }

  texture.refresh();
  return key;
}

/** A card-table border: a double inset line with a suit ornament in each corner. */
function paintFrame(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number, accent: number): void {
  const inset = unit * 1.6;
  const radius = unit * 3;
  ctx.save();
  ctx.lineWidth = Math.max(1, unit * 0.22);
  ctx.strokeStyle = rgba(accent, 0.3);
  roundedPath(ctx, inset, inset, w - inset * 2, h - inset * 2, radius);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, unit * 0.12);
  ctx.strokeStyle = rgba(accent, 0.16);
  roundedPath(ctx, inset * 1.6, inset * 1.6, w - inset * 3.2, h - inset * 3.2, radius * 0.8);
  ctx.stroke();
  ctx.fillStyle = rgba(accent, 0.28);
  ctx.font = `${Math.round(unit * 2.4)}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const corners: [number, number][] = [
    [inset * 2.9, inset * 2.9],
    [w - inset * 2.9, inset * 2.9],
    [w - inset * 2.9, h - inset * 2.9],
    [inset * 2.9, h - inset * 2.9],
  ];
  corners.forEach(([x, y], i) => ctx.fillText(SUIT_ORNAMENTS[i], x, y));
  ctx.restore();
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Adds (or updates) the full-screen table image for a theme. Textures are
 * cached per exact size, so moving between the loading screen and the game,
 * or back to a previous size, never repaints.
 */
export function coverTable(
  scene: Phaser.Scene,
  theme: VariantTheme,
  id: string,
  image?: Phaser.GameObjects.Image
): Phaser.GameObjects.Image {
  const { width, height } = scene.scale;
  const key = paintTable(scene, theme, id, width, height, { frame: true });
  pruneTables(scene, key);
  const target = image ?? scene.add.image(0, 0, key).setDepth(-10);
  return target.setTexture(key).setOrigin(0).setPosition(0, 0);
}

function roundedClip(ctx: CanvasRenderingContext2D, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
  ctx.clip();
}

/** Removes cached table textures of other sizes to free GPU memory after a resize. */
export function pruneTables(scene: Phaser.Scene, keep: string): void {
  scene.textures
    .getTextureKeys()
    .filter((key) => key.startsWith("table_") && !key.startsWith("table_tile") && key !== keep)
    .forEach((key) => scene.textures.remove(key));
}
