import type { Emblem, VariantTheme } from "../core/variant";
import { rgba } from "./color";
import { shade } from "./ui";

/*
 * Illustrated scenes, one per game, so each game is recognisable at a glance:
 * a spider under the moon, fish in the deep, pyramids in the sun… Everything
 * is drawn with canvas paths (sharp at any size, no image assets) in the
 * game's own palette: silhouettes in deep tones of the table colour,
 * highlights in its accent.
 *
 * Scenes are composed for a menu tile, which shows its cards at the top right
 * and its name at the bottom left, so subjects sit in the upper left and
 * centre. Coordinates are in tile heights (`u`), which keeps proportions right
 * on any tile width.
 */

type Point = readonly [number, number];

interface Scene {
  readonly ctx: CanvasRenderingContext2D;
  /** One tile height, in pixels. */
  readonly u: number;
  /** Tile width, in tile heights. */
  readonly width: number;
  readonly theme: VariantTheme;
}

type EmblemPainter = (scene: Scene) => void;

// --- Drawing helpers -------------------------------------------------------

function polygon({ ctx, u }: Scene, points: readonly Point[]): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * u, y * u) : ctx.lineTo(x * u, y * u)));
  ctx.closePath();
}

function ellipse({ ctx, u }: Scene, x: number, y: number, rx: number, ry: number, rotation = 0): void {
  ctx.beginPath();
  ctx.ellipse(x * u, y * u, rx * u, ry * u, rotation, 0, Math.PI * 2);
}

/** A soft radial light. */
function glow({ ctx, u }: Scene, x: number, y: number, radius: number, color: number, alpha: number): void {
  const light = ctx.createRadialGradient(x * u, y * u, 0, x * u, y * u, radius * u);
  light.addColorStop(0, rgba(color, alpha));
  light.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = light;
  ctx.fillRect((x - radius) * u, (y - radius) * u, radius * 2 * u, radius * 2 * u);
}

/** A four-pointed twinkle. */
function sparkle(scene: Scene, x: number, y: number, radius: number, color = 0xffffff, alpha = 0.9): void {
  const { ctx, u } = scene;
  glow(scene, x, y, radius * 1.6, color, alpha * 0.35);
  const [cx, cy, r] = [x * u, y * u, radius * u];
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx, cy, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + r);
  ctx.quadraticCurveTo(cx, cy, cx - r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - r);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
}

/** Small round stars scattered over a sky. */
function stars(scene: Scene, points: readonly (readonly [number, number, number])[], alpha = 0.8): void {
  const { ctx } = scene;
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  for (const [x, y, r] of points) {
    ellipse(scene, x, y, r, r);
    ctx.fill();
  }
}

/** Fills the current path, then strokes a thin dark outline for a crisp, illustrated look. */
function inked(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, outline: string, width: number): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/** A rolling horizon through `points`, filled down to the bottom of the tile. */
function ground(scene: Scene, points: readonly Point[], fill: string | CanvasGradient): void {
  const { ctx, u, width } = scene;
  ctx.beginPath();
  ctx.moveTo(0, points[0][1] * u);
  for (let i = 1; i < points.length; i += 1) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    ctx.quadraticCurveTo(px * u, py * u, ((px + x) / 2) * u, ((py + y) / 2) * u);
  }
  const [lx, ly] = points[points.length - 1];
  ctx.lineTo(lx * u, ly * u);
  ctx.lineTo(width * u, ly * u);
  ctx.lineTo(width * u, 2 * u);
  ctx.lineTo(0, 2 * u);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A puffy cloud. */
function cloud(scene: Scene, x: number, y: number, size: number, alpha = 0.4): void {
  const { ctx } = scene;
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  for (const [dx, dy, r] of [
    [-0.9, 0.15, 0.55],
    [-0.3, -0.2, 0.75],
    [0.4, -0.05, 0.65],
    [0.95, 0.2, 0.45],
  ]) {
    ellipse(scene, x + dx * size, y + dy * size, r * size, r * size);
    ctx.fill();
  }
}

/** A conifer silhouette: stacked tiers on a short trunk. */
function pine(scene: Scene, x: number, base: number, height: number, fill: string, snow = 0): void {
  const { ctx, u } = scene;
  ctx.fillStyle = fill;
  ctx.fillRect((x - 0.012) * u, (base - height * 0.14) * u, 0.024 * u, height * 0.14 * u);
  for (let tier = 0; tier < 3; tier += 1) {
    const top = base - height + tier * height * 0.24;
    const bottom = top + height * 0.42;
    const half = height * (0.15 + tier * 0.07);
    ctx.fillStyle = fill;
    polygon(scene, [
      [x, top],
      [x - half, bottom],
      [x + half, bottom],
    ]);
    ctx.fill();
    if (snow > 0) {
      ctx.fillStyle = `rgba(240, 250, 255, ${snow})`;
      polygon(scene, [
        [x - half, bottom],
        [x - half * 0.55, bottom - height * 0.06],
        [x, bottom - height * 0.02],
        [x + half * 0.55, bottom - height * 0.07],
        [x + half, bottom],
        [x, bottom + height * 0.015],
      ]);
      ctx.fill();
    }
  }
}

/** A row of conifers along the bottom: a forest edge. */
function forest(scene: Scene, base: number, height: number, fill: string): void {
  const heights = [0.8, 1, 0.7, 0.9, 1.1, 0.75, 0.95, 0.85, 1.05, 0.7, 0.9, 1];
  let i = 0;
  for (let x = -0.02; x < scene.width + 0.06; x += height * 0.3) {
    const h = height * heights[i % heights.length];
    pine(scene, x, base + (i % 3) * 0.012, h, fill);
    i += 1;
  }
}

const OUTLINE = "rgba(12, 8, 4, 0.75)";

// --- Klondike: gold country --------------------------------------------------

function nugget(scene: Scene, x: number, y: number, r: number): void {
  const { ctx, u } = scene;
  const bumps = [1, 0.82, 1.08, 0.9, 1.04, 0.78, 0.95];
  ctx.beginPath();
  bumps.forEach((bump, i) => {
    const angle = (i / bumps.length) * Math.PI * 2 + 0.3;
    const px = (x + Math.cos(angle) * r * bump) * u;
    const py = (y + Math.sin(angle) * r * bump * 0.8) * u;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });
  ctx.closePath();
  const gold = ctx.createLinearGradient(0, (y - r) * u, 0, (y + r) * u);
  gold.addColorStop(0, "#fff4b0");
  gold.addColorStop(0.5, rgba(scene.theme.accent));
  gold.addColorStop(1, "#a86b00");
  inked(ctx, gold, "rgba(80, 45, 0, 0.8)", 0.005 * u);
}

const goldRush: EmblemPainter = (scene) => {
  const { ctx, u, width, theme } = scene;
  // Snow-tipped ranges far away.
  const far = rgba(shade(theme.table[0], 0.4), 0.45);
  const peaks: Point[] = [
    [0.12, 0.2],
    [0.32, 0.1],
    [0.5, 0.24],
    [0.68, 0.14],
    [0.9, 0.3],
  ];
  ctx.fillStyle = far;
  polygon(scene, [[0, 0.44], ...peaks, [width, 0.4], [width, 0.6], [0, 0.6]]);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  for (const [x, y] of peaks) {
    polygon(scene, [
      [x, y],
      [x - 0.05, y + 0.055],
      [x - 0.015, y + 0.04],
      [x + 0.02, y + 0.06],
      [x + 0.05, y + 0.05],
    ]);
    ctx.fill();
  }
  // Rolling green hills.
  ground(
    scene,
    [
      [0, 0.44],
      [0.3, 0.36],
      [0.64, 0.46],
      [0.96, 0.4],
      [width, 0.46],
    ],
    rgba(shade(theme.table[0], 0.14), 0.9)
  );
  ground(
    scene,
    [
      [0, 0.6],
      [0.36, 0.52],
      [0.8, 0.6],
      [width, 0.56],
    ],
    rgba(shade(theme.table[1], -0.05), 0.9)
  );
  // A prospector's pan, heaped with gold, resting on the hillside.
  const [px, py] = [0.3, 0.43];
  ellipse(scene, px, py + 0.012, 0.11, 0.036);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fill();
  ellipse(scene, px, py, 0.1, 0.034);
  const pan = ctx.createLinearGradient(0, (py - 0.04) * u, 0, (py + 0.04) * u);
  pan.addColorStop(0, "#d9dde0");
  pan.addColorStop(1, "#5b6368");
  inked(ctx, pan, OUTLINE, 0.006 * u);
  ellipse(scene, px, py - 0.004, 0.078, 0.022);
  ctx.fillStyle = "#3e464b";
  ctx.fill();
  nugget(scene, px - 0.035, py - 0.012, 0.024);
  nugget(scene, px + 0.012, py - 0.02, 0.03);
  nugget(scene, px + 0.045, py - 0.008, 0.02);
  glow(scene, px, py - 0.03, 0.16, theme.accent, 0.35);
  sparkle(scene, px - 0.02, py - 0.07, 0.03, 0xfff4b0);
  sparkle(scene, px + 0.07, py - 0.05, 0.022, 0xfff4b0, 0.8);
  sparkle(scene, 0.58, 0.3, 0.018, 0xfff4b0, 0.6);
};

// --- Spider: a spider under the moon ------------------------------------------

const web: EmblemPainter = (scene) => {
  const { ctx, u, width, theme } = scene;
  stars(scene, [
    [0.12, 0.1, 0.006],
    [0.2, 0.3, 0.004],
    [0.08, 0.42, 0.005],
    [0.74, 0.08, 0.005],
    [0.3, 0.06, 0.004],
  ]);
  // A pale full moon.
  const [mx, my, mr] = [0.44, 0.26, 0.12];
  glow(scene, mx, my, 0.34, 0xf3efe6, 0.3);
  ellipse(scene, mx, my, mr, mr);
  const moon = ctx.createRadialGradient((mx - 0.04) * u, (my - 0.04) * u, 0, mx * u, my * u, mr * u);
  moon.addColorStop(0, "#fbf8f1");
  moon.addColorStop(1, "#cfc9bf");
  ctx.fillStyle = moon;
  ctx.fill();
  ctx.fillStyle = "rgba(120, 110, 100, 0.18)";
  for (const [dx, dy, r] of [
    [-0.03, -0.02, 0.028],
    [0.045, 0.03, 0.02],
    [0.01, 0.06, 0.014],
  ]) {
    ellipse(scene, mx + dx, my + dy, r, r);
    ctx.fill();
  }

  // Web strung from the top-right corner.
  const [ox, oy] = [width + 0.02, -0.03];
  const spokes = [96, 108, 121, 134, 147, 160, 173].map((degrees) => (degrees * Math.PI) / 180);
  const at = (radius: number, angle: number): Point => [ox + Math.cos(angle) * radius, oy + Math.sin(angle) * radius];
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = Math.max(1, 0.006 * u);
  ctx.lineCap = "round";
  for (const angle of spokes) {
    const [x, y] = at(1.25, angle);
    ctx.beginPath();
    ctx.moveTo(ox * u, oy * u);
    ctx.lineTo(x * u, y * u);
    ctx.stroke();
  }
  for (const radius of [0.14, 0.26, 0.39, 0.53, 0.68, 0.84, 1.01]) {
    ctx.beginPath();
    spokes.forEach((angle, i) => {
      const [x, y] = at(radius, angle);
      if (i === 0) {
        ctx.moveTo(x * u, y * u);
        return;
      }
      const [cx, cy] = at(radius * 0.9, (angle + spokes[i - 1]) / 2);
      ctx.quadraticCurveTo(cx * u, cy * u, x * u, y * u);
    });
    ctx.stroke();
  }

  // The spider, hanging head-down on its thread in front of the moon.
  const [sx, sy] = [0.56, 0.36];
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = Math.max(1, 0.005 * u);
  ctx.beginPath();
  ctx.moveTo(sx * u, 0);
  ctx.lineTo(sx * u, (sy - 0.06) * u);
  ctx.stroke();
  const body = "#0c0a10";
  ctx.strokeStyle = body;
  ctx.lineWidth = 0.012 * u;
  ctx.lineJoin = "round";
  [-50, -18, 16, 50].forEach((degrees, k) => {
    for (const side of [-1, 1]) {
      const knee = (degrees * Math.PI) / 180;
      const foot = knee + (55 * Math.PI) / 180;
      const [bx, by] = [sx + side * 0.022, sy + 0.068 + k * 0.012];
      const [kx, ky] = [bx + side * Math.cos(knee) * 0.075, by + Math.sin(knee) * 0.075];
      const [fx, fy] = [kx + side * Math.cos(foot) * 0.075, ky + Math.sin(foot) * 0.075];
      ctx.beginPath();
      ctx.moveTo(bx * u, by * u);
      ctx.lineTo(kx * u, ky * u);
      ctx.lineTo(fx * u, fy * u);
      ctx.stroke();
    }
  });
  const shell = (x: number, y: number, rx: number, ry: number): void => {
    const gradient = ctx.createRadialGradient((x - rx * 0.3) * u, (y - ry * 0.4) * u, 0, x * u, y * u, ry * u);
    gradient.addColorStop(0, "#4a4452");
    gradient.addColorStop(1, body);
    ellipse(scene, x, y, rx, ry);
    ctx.fillStyle = gradient;
    ctx.fill();
  };
  shell(sx, sy, 0.05, 0.062);
  shell(sx, sy + 0.085, 0.032, 0.03);
  ctx.fillStyle = rgba(theme.accent, 0.95);
  polygon(scene, [
    [sx - 0.02, sy - 0.03],
    [sx + 0.02, sy - 0.03],
    [sx, sy],
    [sx + 0.02, sy + 0.03],
    [sx - 0.02, sy + 0.03],
    [sx, sy],
  ]);
  ctx.fill();
};

// --- FreeCell: fish in the deep ------------------------------------------------

function fish(scene: Scene, x: number, y: number, size: number, facingLeft: boolean, fill: string): void {
  const { ctx, u } = scene;
  ctx.save();
  ctx.translate(x * u, y * u);
  ctx.scale(facingLeft ? -size * u : size * u, size * u);
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.quadraticCurveTo(0.35, -0.62, -0.55, 0);
  ctx.quadraticCurveTo(0.35, 0.62, 1, 0);
  ctx.moveTo(-0.45, 0);
  ctx.lineTo(-1.05, -0.42);
  ctx.quadraticCurveTo(-0.85, 0, -1.05, 0.42);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = "rgba(4, 30, 32, 0.8)";
  ctx.beginPath();
  ctx.arc(0.6, -0.1, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function bubble(scene: Scene, x: number, y: number, r: number): void {
  const { ctx, u } = scene;
  ellipse(scene, x, y, r, r);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = Math.max(1, 0.004 * u);
  ctx.stroke();
  ellipse(scene, x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.25);
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fill();
}

const undersea: EmblemPainter = (scene) => {
  const { ctx, u, width, theme } = scene;
  // Sunlight slanting down through the water.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [x, spread] of [
    [0.18, 0.08],
    [0.44, 0.11],
    [0.72, 0.07],
  ]) {
    const beam = ctx.createLinearGradient(0, 0, 0, 0.9 * u);
    beam.addColorStop(0, rgba(theme.accent, 0.2));
    beam.addColorStop(1, rgba(theme.accent, 0));
    ctx.fillStyle = beam;
    polygon(scene, [
      [x - spread / 2, 0],
      [x + spread / 2, 0],
      [x + spread * 1.6 + 0.12, 0.9],
      [x + 0.1, 0.9],
    ]);
    ctx.fill();
  }
  ctx.restore();

  const light = rgba(shade(theme.accent, 0.15), 0.85);
  fish(scene, 0.24, 0.24, 0.08, false, light);
  fish(scene, 0.41, 0.34, 0.05, false, rgba(shade(theme.accent, 0.15), 0.7));
  fish(scene, 0.72, 0.45, 0.065, true, rgba(shade(theme.accent, 0.15), 0.75));
  for (const [x, y, r] of [
    [0.6, 0.42, 0.018],
    [0.63, 0.32, 0.014],
    [0.59, 0.22, 0.02],
    [0.62, 0.12, 0.012],
    [0.58, 0.05, 0.01],
    [0.33, 0.19, 0.01],
    [0.35, 0.13, 0.007],
  ]) {
    bubble(scene, x, y, r);
  }

  // Sandy floor with swaying weed.
  ground(
    scene,
    [
      [0, 0.8],
      [0.5, 0.76],
      [width, 0.82],
    ],
    rgba(shade(theme.table[1], 0.15), 0.8)
  );
  ctx.strokeStyle = rgba(shade(theme.table[1], -0.2), 0.8);
  ctx.lineCap = "round";
  for (const [x, height, sway] of [
    [0.06, 0.34, 0.03],
    [0.11, 0.26, -0.025],
    [width - 0.1, 0.3, 0.025],
    [width - 0.05, 0.22, -0.02],
  ]) {
    ctx.lineWidth = 0.018 * u;
    ctx.beginPath();
    ctx.moveTo(x * u, 0.84 * u);
    ctx.bezierCurveTo(
      (x + sway) * u,
      (0.84 - height * 0.35) * u,
      (x - sway) * u,
      (0.84 - height * 0.7) * u,
      (x + sway * 0.5) * u,
      (0.84 - height) * u
    );
    ctx.stroke();
  }
};

// --- Pyramid: pyramids in the desert sun -------------------------------------

function pyramid(scene: Scene, apex: Point, halfWidth: number, base: number, alpha: number): void {
  const { ctx, u, theme } = scene;
  const [ax, ay] = apex;
  const split = ax + halfWidth * 0.22;
  ctx.fillStyle = rgba(shade(theme.table[0], 0.38), alpha);
  polygon(scene, [apex, [ax - halfWidth, base], [split, base]]);
  ctx.fill();
  ctx.fillStyle = rgba(shade(theme.table[1], -0.15), alpha);
  polygon(scene, [apex, [split, base], [ax + halfWidth, base]]);
  ctx.fill();
  // Courses of stone.
  ctx.save();
  polygon(scene, [apex, [ax - halfWidth, base], [ax + halfWidth, base]]);
  ctx.clip();
  ctx.strokeStyle = `rgba(60, 30, 5, ${0.22 * alpha})`;
  ctx.lineWidth = Math.max(1, 0.004 * u);
  for (let y = ay + 0.05; y < base; y += 0.05) {
    ctx.beginPath();
    ctx.moveTo((ax - halfWidth) * u, y * u);
    ctx.lineTo((ax + halfWidth) * u, y * u);
    ctx.stroke();
  }
  ctx.restore();
  // Sunlit ridge.
  ctx.strokeStyle = `rgba(255, 244, 207, ${0.55 * alpha})`;
  ctx.lineWidth = Math.max(1, 0.006 * u);
  ctx.beginPath();
  ctx.moveTo(ax * u, ay * u);
  ctx.lineTo(split * u, base * u);
  ctx.stroke();
}

const pyramids: EmblemPainter = (scene) => {
  const { ctx, u, width, theme } = scene;
  const [sx, sy, sr] = [0.2, 0.2, 0.09];
  glow(scene, sx, sy, 0.34, theme.accent, 0.5);
  ellipse(scene, sx, sy, sr, sr);
  const sun = ctx.createRadialGradient((sx - 0.02) * u, (sy - 0.02) * u, 0, sx * u, sy * u, sr * u);
  sun.addColorStop(0, "#fffcef");
  sun.addColorStop(1, "#ffe9b0");
  ctx.fillStyle = sun;
  ctx.fill();

  pyramid(scene, [0.62, 0.12], 0.56, 0.72, 0.95);
  pyramid(scene, [0.14, 0.42], 0.22, 0.72, 0.85);

  ground(
    scene,
    [
      [0, 0.7],
      [0.3, 0.66],
      [0.62, 0.72],
      [width, 0.68],
    ],
    rgba(shade(theme.table[0], 0.12), 0.65)
  );
  ground(
    scene,
    [
      [0, 0.82],
      [0.4, 0.76],
      [0.9, 0.82],
      [width, 0.78],
    ],
    rgba(shade(theme.table[1], 0.05), 0.6)
  );
};

// --- TriPeaks: snowy peaks over the forest -------------------------------------

function mountain(scene: Scene, apex: Point, halfWidth: number, base: number, alpha: number): void {
  const { ctx, theme } = scene;
  const [ax, ay] = apex;
  const split = ax + halfWidth * 0.12;
  ctx.fillStyle = rgba(shade(theme.table[0], 0.22), alpha);
  polygon(scene, [apex, [ax - halfWidth, base], [split, base]]);
  ctx.fill();
  ctx.fillStyle = rgba(shade(theme.table[1], -0.1), alpha);
  polygon(scene, [apex, [split, base], [ax + halfWidth, base]]);
  ctx.fill();
  // Snow cap with a jagged lower edge, lit on the left.
  const depth = (base - ay) * 0.34;
  const jag = depth * 0.22;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.94 * alpha})`;
  polygon(scene, [
    apex,
    [ax - halfWidth * 0.34, ay + depth],
    [ax - halfWidth * 0.2, ay + depth - jag],
    [ax - halfWidth * 0.08, ay + depth + jag * 0.4],
    [split, ay + depth - jag * 0.6],
  ]);
  ctx.fill();
  ctx.fillStyle = `rgba(200, 222, 245, ${0.88 * alpha})`;
  polygon(scene, [
    apex,
    [split, ay + depth - jag * 0.6],
    [ax + halfWidth * 0.14, ay + depth + jag * 0.5],
    [ax + halfWidth * 0.24, ay + depth - jag * 0.5],
    [ax + halfWidth * 0.34, ay + depth],
  ]);
  ctx.fill();
}

const peaks: EmblemPainter = (scene) => {
  const { theme } = scene;
  stars(scene, [
    [0.08, 0.08, 0.005],
    [0.56, 0.06, 0.004],
    [0.7, 0.16, 0.005],
  ]);
  glow(scene, 0.34, 0.2, 0.4, theme.accent, 0.2);
  cloud(scene, 0.14, 0.12, 0.05, 0.35);
  mountain(scene, [0.08, 0.34], 0.26, 0.68, 0.8);
  mountain(scene, [0.72, 0.26], 0.32, 0.68, 0.8);
  mountain(scene, [0.36, 0.1], 0.42, 0.68, 1);
  cloud(scene, 0.58, 0.36, 0.045, 0.3);
  forest(scene, 0.8, 0.22, rgba(shade(theme.table[1], -0.55), 0.95));
};

// --- Golf: flag on the green ------------------------------------------------

const golf: EmblemPainter = (scene) => {
  const { ctx, u, width, theme } = scene;
  cloud(scene, 0.16, 0.14, 0.07);
  cloud(scene, 0.74, 0.08, 0.05);
  // A line of trees behind the course.
  ctx.fillStyle = rgba(shade(theme.table[1], -0.25), 0.75);
  for (let x = -0.04, i = 0; x < width + 0.1; x += 0.07, i += 1) {
    const r = 0.05 + (i % 3) * 0.012;
    ellipse(scene, x, 0.44 - (i % 2) * 0.02, r, r * 1.1);
    ctx.fill();
  }
  ctx.fillRect(0, 0.44 * u, width * u, 0.1 * u);
  ground(
    scene,
    [
      [0, 0.62],
      [0.3, 0.48],
      [0.8, 0.5],
      [width, 0.6],
    ],
    rgba(shade(theme.table[0], 0.18), 0.95)
  );
  // The green, the cup and the pin.
  ellipse(scene, 0.44, 0.545, 0.25, 0.07);
  ctx.fillStyle = rgba(shade(theme.table[0], 0.42), 0.9);
  ctx.fill();
  ellipse(scene, 0.44, 0.548, 0.032, 0.012);
  ctx.fillStyle = "#10240a";
  ctx.fill();
  ctx.strokeStyle = "#f5f5f5";
  ctx.lineWidth = 0.012 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0.44 * u, 0.545 * u);
  ctx.lineTo(0.44 * u, 0.1 * u);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.446 * u, 0.1 * u);
  ctx.quadraticCurveTo(0.54 * u, 0.1 * u, 0.64 * u, 0.15 * u);
  ctx.quadraticCurveTo(0.54 * u, 0.19 * u, 0.446 * u, 0.21 * u);
  ctx.closePath();
  const flag = ctx.createLinearGradient(0.44 * u, 0, 0.64 * u, 0);
  flag.addColorStop(0, "#ff6b5b");
  flag.addColorStop(1, "#d6352a");
  inked(ctx, flag, "rgba(90, 10, 5, 0.6)", 0.005 * u);
  // The ball, just short of the cup.
  ellipse(scene, 0.625, 0.535, 0.035, 0.009);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fill();
  ellipse(scene, 0.62, 0.51, 0.028, 0.028);
  const ball = ctx.createRadialGradient(0.61 * u, 0.5 * u, 0, 0.62 * u, 0.51 * u, 0.028 * u);
  ball.addColorStop(0, "#ffffff");
  ball.addColorStop(1, "#c5ced3");
  ctx.fillStyle = ball;
  ctx.fill();
};

// --- Yukon: a cabin under the northern lights ----------------------------------

const pines: EmblemPainter = (scene) => {
  const { ctx, u, width, theme } = scene;
  // Aurora ribbons.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const band of [
    { y: 0.12, amp: 0.05, phase: 0, color: 0x69f0ae },
    { y: 0.22, amp: 0.04, phase: 1.4, color: 0xb388ff },
    { y: 0.3, amp: 0.03, phase: 2.6, color: theme.accent },
  ]) {
    const curve = (x: number): number => band.y + Math.sin(x * 4.2 + band.phase) * band.amp;
    ctx.beginPath();
    ctx.moveTo(0, curve(0) * u);
    for (let x = 0.05; x <= width + 0.05; x += 0.05) {
      ctx.lineTo(x * u, curve(x) * u);
    }
    for (let x = width + 0.05; x >= 0; x -= 0.05) {
      ctx.lineTo(x * u, (curve(x) + 0.18) * u);
    }
    ctx.closePath();
    const light = ctx.createLinearGradient(0, (band.y - band.amp) * u, 0, (band.y + 0.22) * u);
    light.addColorStop(0, rgba(band.color, 0.45));
    light.addColorStop(1, rgba(band.color, 0));
    ctx.fillStyle = light;
    ctx.fill();
  }
  ctx.restore();
  stars(scene, [
    [0.06, 0.06, 0.005],
    [0.3, 0.05, 0.004],
    [0.5, 0.16, 0.005],
    [0.82, 0.06, 0.004],
    [0.16, 0.36, 0.004],
  ]);

  // Snowy hill with a lit cabin.
  ground(
    scene,
    [
      [0, 0.64],
      [0.46, 0.52],
      [0.9, 0.6],
      [width, 0.58],
    ],
    "rgba(226, 242, 255, 0.55)"
  );
  const [cx, cy] = [0.6, 0.52];
  ctx.fillStyle = "#6b4526";
  ctx.fillRect((cx - 0.075) * u, (cy - 0.07) * u, 0.15 * u, 0.08 * u);
  ctx.strokeStyle = "rgba(40, 22, 10, 0.6)";
  ctx.lineWidth = Math.max(1, 0.004 * u);
  for (let y = cy - 0.05; y < cy + 0.01; y += 0.02) {
    ctx.beginPath();
    ctx.moveTo((cx - 0.075) * u, y * u);
    ctx.lineTo((cx + 0.075) * u, y * u);
    ctx.stroke();
  }
  ctx.fillStyle = "#3b2414";
  polygon(scene, [
    [cx - 0.1, cy - 0.065],
    [cx, cy - 0.14],
    [cx + 0.1, cy - 0.065],
  ]);
  ctx.fill();
  ctx.fillStyle = "rgba(245, 250, 255, 0.95)";
  polygon(scene, [
    [cx - 0.1, cy - 0.065],
    [cx, cy - 0.14],
    [cx + 0.1, cy - 0.065],
    [cx + 0.07, cy - 0.075],
    [cx, cy - 0.12],
    [cx - 0.07, cy - 0.075],
  ]);
  ctx.fill();
  ctx.fillStyle = "#3b2414";
  ctx.fillRect((cx + 0.04) * u, (cy - 0.14) * u, 0.02 * u, 0.05 * u);
  glow(scene, cx - 0.03, cy - 0.03, 0.08, 0xffd180, 0.6);
  ctx.fillStyle = "#ffd98a";
  ctx.fillRect((cx - 0.045) * u, (cy - 0.045) * u, 0.03 * u, 0.028 * u);
  cloud(scene, cx + 0.06, cy - 0.19, 0.018, 0.3);
  cloud(scene, cx + 0.09, cy - 0.24, 0.022, 0.2);

  const silhouette = "rgba(6, 18, 26, 0.95)";
  pine(scene, 0.07, 0.72, 0.5, silhouette);
  pine(scene, 0.2, 0.74, 0.4, silhouette);
  pine(scene, width - 0.14, 0.72, 0.36, silhouette);
  pine(scene, width - 0.04, 0.74, 0.46, silhouette);
  forest(scene, 0.86, 0.16, silhouette);
};

// --- Scorpion: on the mesa at sunset -------------------------------------------

const scorpion: EmblemPainter = (scene) => {
  const { ctx, u, width, theme } = scene;
  const [sx, sy, sr] = [0.5, 0.36, 0.22];
  glow(scene, sx, sy, 0.5, theme.accent, 0.4);
  ellipse(scene, sx, sy, sr, sr);
  const sun = ctx.createRadialGradient((sx - 0.03) * u, (sy - 0.04) * u, 0, sx * u, sy * u, sr * u);
  sun.addColorStop(0, "#fff0cf");
  sun.addColorStop(0.55, rgba(theme.accent, 0.95));
  sun.addColorStop(1, rgba(shade(theme.accent, -0.3), 0.9));
  ctx.fillStyle = sun;
  ctx.fill();

  const ink = "rgba(22, 6, 3, 0.96)";
  // A flat-topped mesa with a smaller butte beside it.
  ctx.fillStyle = ink;
  polygon(scene, [
    [0, 0.74],
    [0.03, 0.66],
    [0.1, 0.65],
    [0.13, 0.74],
  ]);
  ctx.fill();
  polygon(scene, [
    [0.14, 1.1],
    [0.2, 0.68],
    [0.24, 0.64],
    [0.86, 0.64],
    [0.9, 0.69],
    [0.95, 1.1],
  ]);
  ctx.fill();
  ground(
    scene,
    [
      [0, 0.8],
      [0.5, 0.78],
      [width, 0.82],
    ],
    ink
  );
  ctx.strokeStyle = rgba(theme.accent, 0.18);
  ctx.lineWidth = Math.max(1, 0.004 * u);
  for (const y of [0.7, 0.76]) {
    ctx.beginPath();
    ctx.moveTo(0.22 * u, y * u);
    ctx.lineTo(0.88 * u, y * u);
    ctx.stroke();
  }

  // The scorpion, silhouetted against the sun.
  ctx.save();
  ctx.translate(0.14 * u, 0);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.011 * u;
  [
    [0.3, -0.035, -0.07],
    [0.34, -0.015, -0.03],
    [0.38, 0.012, 0.03],
    [0.42, 0.03, 0.065],
  ].forEach(([x, knee, foot]) => {
    ctx.beginPath();
    ctx.moveTo(x * u, 0.565 * u);
    ctx.lineTo((x + knee) * u, 0.595 * u);
    ctx.lineTo((x + foot) * u, 0.64 * u);
    ctx.stroke();
  });
  ellipse(scene, 0.3, 0.555, 0.07, 0.04);
  ctx.fill();
  [
    [0.375, 0.55, 0.042, 0.038],
    [0.435, 0.545, 0.04, 0.036],
    [0.49, 0.54, 0.037, 0.033],
    [0.54, 0.535, 0.033, 0.03],
  ].forEach(([x, y, rx, ry]) => {
    ellipse(scene, x, y, rx, ry);
    ctx.fill();
  });
  const tail = (t: number): Point => {
    const mt = 1 - t;
    const p: Point[] = [
      [0.57, 0.525],
      [0.67, 0.46],
      [0.67, 0.25],
      [0.54, 0.215],
    ];
    return [
      mt ** 3 * p[0][0] + 3 * mt * mt * t * p[1][0] + 3 * mt * t * t * p[2][0] + t ** 3 * p[3][0],
      mt ** 3 * p[0][1] + 3 * mt * mt * t * p[1][1] + 3 * mt * t * t * p[2][1] + t ** 3 * p[3][1],
    ];
  };
  // A tapering tail with a bump for each segment.
  ctx.lineWidth = 0.034 * u;
  ctx.beginPath();
  for (let t = 0; t <= 0.86; t += 0.02) {
    const [x, y] = tail(t);
    if (t === 0) {
      ctx.moveTo(x * u, y * u);
    } else {
      ctx.lineTo(x * u, y * u);
    }
  }
  ctx.stroke();
  for (let i = 0; i < 6; i += 1) {
    const [x, y] = tail(0.06 + i * 0.15);
    const r = 0.026 - i * 0.0015;
    ellipse(scene, x, y, r, r);
    ctx.fill();
  }
  ellipse(scene, 0.525, 0.22, 0.032, 0.024, -0.3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.5 * u, 0.212 * u);
  ctx.quadraticCurveTo(0.455 * u, 0.205 * u, 0.462 * u, 0.255 * u);
  ctx.lineTo(0.482 * u, 0.232 * u);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 0.022 * u;
  for (const flip of [1, -1]) {
    const y0 = 0.555 - flip * 0.022;
    ctx.beginPath();
    ctx.moveTo(0.25 * u, y0 * u);
    ctx.lineTo(0.2 * u, (y0 - flip * 0.045) * u);
    ctx.lineTo(0.15 * u, (y0 - flip * 0.075) * u);
    ctx.stroke();
    const hy = y0 - flip * 0.08;
    ellipse(scene, 0.135, hy, 0.04, 0.026, flip * 0.35);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.115 * u, (hy - flip * 0.012) * u);
    ctx.quadraticCurveTo(0.06 * u, (hy - flip * 0.035) * u, 0.045 * u, (hy - flip * 0.004) * u);
    ctx.quadraticCurveTo(0.075 * u, (hy - flip * 0.012) * u, 0.1 * u, (hy + flip * 0.004) * u);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.11 * u, (hy + flip * 0.014) * u);
    ctx.quadraticCurveTo(0.07 * u, (hy + flip * 0.03) * u, 0.055 * u, (hy + flip * 0.008) * u);
    ctx.quadraticCurveTo(0.08 * u, (hy + flip * 0.012) * u, 0.1 * u, hy * u);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

// --- Meridian: the moon above, the sun setting into the sea ---------------------

const sunrise: EmblemPainter = (scene) => {
  const { ctx, u, width, theme } = scene;
  const horizon = 0.6;
  const [sx, radius] = [0.34, 0.16];
  // Rays fanning up from the horizon.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = rgba(theme.accent, 0.1);
  for (let i = 0; i < 9; i += 1) {
    const from = Math.PI + (i / 9) * Math.PI;
    const to = from + Math.PI / 18;
    ctx.beginPath();
    ctx.moveTo(sx * u, horizon * u);
    ctx.lineTo((sx + Math.cos(from) * 1.3) * u, (horizon + Math.sin(from) * 1.3) * u);
    ctx.lineTo((sx + Math.cos(to) * 1.3) * u, (horizon + Math.sin(to) * 1.3) * u);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(scene, sx, horizon, 0.46, theme.accent, 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width * u, horizon * u);
  ctx.clip();
  ellipse(scene, sx, horizon, radius, radius);
  const sun = ctx.createRadialGradient(sx * u, (horizon - 0.05) * u, 0, sx * u, horizon * u, radius * u);
  sun.addColorStop(0, "#fff8e1");
  sun.addColorStop(0.6, rgba(theme.accent));
  sun.addColorStop(1, "#ff8a50");
  ctx.fillStyle = sun;
  ctx.fill();
  ctx.restore();
  // The sea: gentle swells and the sun's reflection.
  ctx.fillStyle = rgba(shade(theme.table[1], -0.2), 0.6);
  ctx.fillRect(0, horizon * u, width * u, u);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255, 220, 190, 0.25)";
  ctx.lineWidth = Math.max(1, 0.006 * u);
  for (let row = 0; row < 4; row += 1) {
    const y = horizon + 0.05 + row * 0.07;
    ctx.beginPath();
    for (let x = -0.05; x < width + 0.1; x += 0.1) {
      ctx.moveTo(x * u, y * u);
      ctx.quadraticCurveTo((x + 0.025) * u, (y - 0.018) * u, (x + 0.05) * u, y * u);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(theme.accent, 0.55);
  for (let k = 1; k <= 6; k += 1) {
    const half = radius * (1 - k * 0.13);
    ctx.globalAlpha = 1 - k * 0.14;
    ctx.lineWidth = 0.011 * u;
    ctx.beginPath();
    ctx.moveTo((sx - half) * u, (horizon + k * 0.032) * u);
    ctx.lineTo((sx + half) * u, (horizon + k * 0.032) * u);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Crescent moon: a disc with a bite taken out, drawn on its own canvas.
  const [mx, my] = [0.2, 0.2];
  const size = Math.ceil(0.2 * u);
  const moon = document.createElement("canvas");
  moon.width = size;
  moon.height = size;
  const m = moon.getContext("2d") as CanvasRenderingContext2D;
  m.fillStyle = "#fff6d8";
  m.beginPath();
  m.arc(size / 2, size / 2, 0.065 * u, 0, Math.PI * 2);
  m.fill();
  m.globalCompositeOperation = "destination-out";
  m.beginPath();
  m.arc(size / 2 + 0.032 * u, size / 2 - 0.022 * u, 0.06 * u, 0, Math.PI * 2);
  m.fill();
  glow(scene, mx, my, 0.14, 0xfff6d8, 0.35);
  ctx.drawImage(moon, mx * u - size / 2, my * u - size / 2);
  sparkle(scene, 0.62, 0.1, 0.02, 0xffffff, 0.8);
  sparkle(scene, 0.08, 0.36, 0.015, 0xffffff, 0.6);
  stars(scene, [
    [0.36, 0.08, 0.005],
    [0.74, 0.22, 0.004],
    [0.5, 0.2, 0.004],
  ]);
};

// --- Gemini: the twin stars ---------------------------------------------------

const twins: EmblemPainter = (scene) => {
  const { ctx, u, theme } = scene;
  // A soft nebula behind the constellation.
  glow(scene, 0.44, 0.3, 0.5, shade(theme.accent, -0.2), 0.3);
  stars(scene, [
    [0.12, 0.44, 0.005],
    [0.8, 0.1, 0.005],
    [0.2, 0.3, 0.004],
    [0.66, 0.06, 0.004],
    [0.86, 0.3, 0.005],
    [0.48, 0.52, 0.004],
  ]);
  sparkle(scene, 0.1, 0.12, 0.06, 0xffffff, 0.95);

  // Castor and Pollux as stick figures, holding hands.
  const castor: Point[] = [
    [0.33, 0.1],
    [0.34, 0.22],
    [0.31, 0.33],
    [0.26, 0.46],
    [0.38, 0.45],
    [0.22, 0.2],
  ];
  const pollux: Point[] = [
    [0.57, 0.13],
    [0.56, 0.25],
    [0.58, 0.36],
    [0.52, 0.47],
    [0.64, 0.46],
    [0.69, 0.22],
  ];
  const links: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [2, 4],
    [1, 5],
  ];
  ctx.save();
  ctx.strokeStyle = rgba(theme.accent, 0.6);
  ctx.shadowColor = rgba(theme.accent, 0.8);
  ctx.shadowBlur = 0.02 * u;
  ctx.lineWidth = Math.max(1, 0.008 * u);
  ctx.lineCap = "round";
  const line = ([ax, ay]: Point, [bx, by]: Point): void => {
    ctx.beginPath();
    ctx.moveTo(ax * u, ay * u);
    ctx.lineTo(bx * u, by * u);
    ctx.stroke();
  };
  for (const figure of [castor, pollux]) {
    links.forEach(([a, b]) => line(figure[a], figure[b]));
  }
  line(castor[1], pollux[1]);
  ctx.restore();
  for (const figure of [castor, pollux]) {
    figure.forEach(([x, y], i) =>
      sparkle(scene, x, y, i === 0 ? 0.05 : 0.024, i === 0 ? 0xffffff : shade(theme.accent, 0.5))
    );
  }

  // A ringed planet drifting by.
  const [px, py, pr] = [0.82, 0.44, 0.07];
  ctx.save();
  ctx.translate(px * u, py * u);
  ctx.rotate(-0.35);
  ctx.strokeStyle = rgba(shade(theme.accent, 0.3), 0.75);
  ctx.lineWidth = 0.012 * u;
  ctx.beginPath();
  ctx.ellipse(0, 0, pr * 1.9 * u, pr * 0.5 * u, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  const planet = ctx.createRadialGradient(-pr * 0.4 * u, -pr * 0.4 * u, 0, 0, 0, pr * u);
  planet.addColorStop(0, rgba(shade(theme.accent, 0.5)));
  planet.addColorStop(1, rgba(shade(theme.accent, -0.35)));
  ctx.fillStyle = planet;
  ctx.beginPath();
  ctx.arc(0, 0, pr * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, pr * 1.9 * u, pr * 0.5 * u, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
};

const EMBLEMS: Readonly<Record<Emblem, EmblemPainter>> = {
  goldRush,
  web,
  undersea,
  pyramids,
  peaks,
  golf,
  pines,
  scorpion,
  sunrise,
  twins,
};

/** Paints a game's scene over its table background (`w` × `h` pixels). */
export function paintEmblem(
  ctx: CanvasRenderingContext2D,
  emblem: Emblem,
  w: number,
  h: number,
  theme: VariantTheme
): void {
  ctx.save();
  EMBLEMS[emblem]({ ctx, u: h, width: w / h, theme });
  ctx.restore();
}
