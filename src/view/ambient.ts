import * as Phaser from "phaser";
import { ALL_SUITS } from "../core/cards";
import type { Ambient, VariantTheme } from "../core/variant";
import { traceSuit } from "./suits";

const DEPTH_AMBIENT = -5;

type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

/** White suit symbols (♥ ♦ ♣ ♠ as frames 0–3), tinted per game. */
const GLYPHS = "fx_suit_glyphs";
const GLYPH_CELL = 64;
/** Height of a glyph inside its cell, in pixels. */
const GLYPH_SIZE = GLYPH_CELL * 0.72;

function ensureGlyphTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GLYPHS)) {
    return;
  }
  const texture = scene.textures.createCanvas(GLYPHS, GLYPH_CELL * 4, GLYPH_CELL);
  if (!texture) {
    return;
  }
  const ctx = texture.getContext();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
  ctx.shadowBlur = GLYPH_CELL * 0.08;
  ALL_SUITS.forEach((suit) => {
    ctx.save();
    ctx.translate(suit * GLYPH_CELL + GLYPH_CELL / 2, GLYPH_CELL / 2);
    traceSuit(ctx, suit, GLYPH_SIZE / 2);
    ctx.fill();
    ctx.restore();
    texture.add(suit, 0, suit * GLYPH_CELL, 0, GLYPH_CELL, GLYPH_CELL);
  });
  texture.refresh();
}

/**
 * Per-game atmosphere: the four suit symbols drifting in the game's own way
 * (rising motes, falling snow, bubbles, embers, blowing sand, tumbling
 * petals, twinkles). A few dozen faint particles at a time — enough to make
 * the table feel alive, cheap next to the cards.
 */
function preset(kind: Ambient, width: number, height: number, unit: number, accent: number): EmitterConfig {
  const across = { min: 0, max: width };
  // Scale at which a glyph is `unit` pixels tall.
  const g = unit / GLYPH_SIZE;
  const frames = { frame: [0, 1, 2, 3] };
  switch (kind) {
    case "motes":
      return {
        ...frames,
        x: across,
        y: { min: height * 0.2, max: height * 1.05 },
        speedY: { min: -unit * 0.6, max: -unit * 1.6 },
        speedX: { min: -unit * 0.3, max: unit * 0.3 },
        rotate: { min: -25, max: 25 },
        scale: { start: g * 0.7, end: g * 0.3 },
        alpha: { start: 0.4, end: 0 },
        lifespan: 9000,
        frequency: 480,
        tint: accent,
        blendMode: Phaser.BlendModes.ADD,
      };
    case "snow":
      return {
        ...frames,
        x: across,
        y: -unit,
        speedY: { min: unit * 1.2, max: unit * 3 },
        speedX: { min: -unit * 0.6, max: unit * 0.6 },
        rotate: { start: -40, end: 80 },
        scale: { min: g * 0.35, max: g * 0.8 },
        alpha: { start: 0.55, end: 0.1 },
        lifespan: 16000,
        frequency: 340,
      };
    case "bubbles":
      return {
        ...frames,
        x: across,
        y: height + unit,
        speedY: { min: -unit * 1.5, max: -unit * 3.2 },
        speedX: { min: -unit * 0.3, max: unit * 0.3 },
        scale: { min: g * 0.4, max: g * 0.9 },
        alpha: { start: 0.3, end: 0 },
        lifespan: 11000,
        frequency: 600,
        tint: accent,
      };
    case "embers":
      return {
        ...frames,
        x: across,
        y: height + unit,
        speedY: { min: -unit * 2, max: -unit * 4.5 },
        speedX: { min: -unit * 0.8, max: unit * 0.8 },
        rotate: { min: -30, max: 30 },
        scale: { start: g * 0.6, end: 0 },
        alpha: { start: 0.75, end: 0 },
        lifespan: 7000,
        frequency: 380,
        tint: [accent, 0xff7043],
        blendMode: Phaser.BlendModes.ADD,
      };
    case "sand":
      return {
        ...frames,
        x: -unit,
        y: { min: 0, max: height },
        speedX: { min: unit * 2, max: unit * 5 },
        speedY: { min: -unit * 0.4, max: unit * 0.4 },
        rotate: { start: 0, end: 200 },
        scale: { min: g * 0.25, max: g * 0.45 },
        alpha: { start: 0.4, end: 0.1 },
        lifespan: 14000,
        frequency: 280,
        tint: accent,
      };
    case "petals":
      return {
        ...frames,
        x: across,
        y: -unit,
        speedY: { min: unit * 1.2, max: unit * 2.6 },
        speedX: { min: unit * 0.4, max: unit * 1.6 },
        rotate: { start: 0, end: 540 },
        scale: { min: g * 0.5, max: g * 0.8 },
        alpha: { start: 0.5, end: 0.2 },
        lifespan: 16000,
        frequency: 800,
        tint: [accent, 0xffffff],
      };
    case "twinkle":
      return {
        ...frames,
        x: across,
        y: { min: 0, max: height },
        speed: 0,
        scale: { start: g * 0.8, end: 0 },
        alpha: { start: 0.85, end: 0 },
        lifespan: 2600,
        frequency: 220,
        tint: [0xffffff, accent],
        blendMode: Phaser.BlendModes.ADD,
      };
  }
}

/** Adds the atmosphere for a theme; returns the emitter (destroyed with the scene). */
export function addAmbient(
  scene: Phaser.Scene,
  theme: VariantTheme,
  unit: number
): Phaser.GameObjects.Particles.ParticleEmitter {
  const { width, height } = scene.scale;
  ensureGlyphTexture(scene);
  const emitter = scene.add.particles(0, 0, GLYPHS, preset(theme.ambient, width, height, unit, theme.accent));
  emitter.setDepth(DEPTH_AMBIENT);
  // Start "mid-scene" so the effect doesn't visibly begin from nothing.
  emitter.fastForward(6000, 50);
  return emitter;
}
