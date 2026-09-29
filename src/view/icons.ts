import type * as Phaser from "phaser";

export type IconName =
  "undo" | "hint" | "home" | "deal" | "gear" | "help" | "play" | "magic" | "close" | "back" | "trophy";

type IconPainter = (g: Phaser.GameObjects.Graphics, s: number) => void;

/*
 * Vector icons drawn with Graphics so they scale crisply and take any tint.
 * Each painter draws centred on (0, 0) within a box of size `s`.
 */
const ICONS: Record<IconName, IconPainter> = {
  undo(g, s) {
    g.beginPath();
    g.arc(0, s * 0.05, s * 0.3, Math.PI * 1.05, Math.PI * 0.35, false);
    g.strokePath();
    g.fillTriangle(-s * 0.46, -s * 0.08, -s * 0.14, -s * 0.1, -s * 0.33, s * 0.2);
  },
  hint(g, s) {
    g.strokeCircle(0, -s * 0.1, s * 0.24);
    g.fillRect(-s * 0.12, s * 0.16, s * 0.24, s * 0.08);
    g.fillRect(-s * 0.09, s * 0.28, s * 0.18, s * 0.07);
    g.lineBetween(-s * 0.42, -s * 0.1, -s * 0.34, -s * 0.1);
    g.lineBetween(s * 0.34, -s * 0.1, s * 0.42, -s * 0.1);
    g.lineBetween(0, -s * 0.46, 0, -s * 0.4);
  },
  home(g, s) {
    g.fillTriangle(-s * 0.4, -s * 0.02, s * 0.4, -s * 0.02, 0, -s * 0.4);
    g.fillRect(-s * 0.28, -s * 0.04, s * 0.56, s * 0.4);
  },
  deal(g, s) {
    g.strokeRoundedRect(-s * 0.34, -s * 0.3, s * 0.4, s * 0.56, s * 0.05);
    g.fillRoundedRect(-s * 0.06, -s * 0.22, s * 0.4, s * 0.56, s * 0.05);
  },
  gear(g, s) {
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      g.fillCircle(Math.cos(a) * s * 0.32, Math.sin(a) * s * 0.32, s * 0.09);
    }
    g.fillCircle(0, 0, s * 0.3);
  },
  help(g, s) {
    g.beginPath();
    g.arc(0, -s * 0.14, s * 0.18, Math.PI * 1.05, Math.PI * 0.45, false);
    g.strokePath();
    g.lineBetween(s * 0.03, s * 0.03, 0, s * 0.14);
    g.fillCircle(0, s * 0.3, s * 0.06);
  },
  play(g, s) {
    g.fillTriangle(-s * 0.22, -s * 0.3, -s * 0.22, s * 0.3, s * 0.32, 0);
  },
  magic(g, s) {
    const star = (cx: number, cy: number, r: number): void => {
      g.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const radius = i % 2 === 0 ? r : r * 0.45;
        g.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      }
      g.closePath();
      g.fillPath();
    };
    star(-s * 0.08, s * 0.06, s * 0.3);
    star(s * 0.28, -s * 0.26, s * 0.13);
  },
  close(g, s) {
    g.lineBetween(-s * 0.26, -s * 0.26, s * 0.26, s * 0.26);
    g.lineBetween(s * 0.26, -s * 0.26, -s * 0.26, s * 0.26);
  },
  back(g, s) {
    g.lineBetween(s * 0.12, -s * 0.3, -s * 0.16, 0);
    g.lineBetween(-s * 0.16, 0, s * 0.12, s * 0.3);
  },
  trophy(g, s) {
    g.fillRoundedRect(-s * 0.24, -s * 0.36, s * 0.48, s * 0.36, { tl: 0, tr: 0, bl: s * 0.2, br: s * 0.2 });
    g.fillRect(-s * 0.04, 0, s * 0.08, s * 0.2);
    g.fillRect(-s * 0.2, s * 0.2, s * 0.4, s * 0.1);
    g.strokeCircle(-s * 0.28, -s * 0.2, s * 0.1);
    g.strokeCircle(s * 0.28, -s * 0.2, s * 0.1);
  },
};

export function drawIcon(
  scene: Phaser.Scene,
  name: IconName,
  size: number,
  color: number
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(Math.max(1.5, size * 0.09), color, 1);
  g.fillStyle(color, 1);
  ICONS[name](g, size);
  return g;
}
