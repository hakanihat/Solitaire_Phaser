import * as Phaser from "phaser";
import type { Ambient, VariantTheme } from "../core/variant";
import { FX } from "../scenes/keys";

const DEPTH_AMBIENT = -5;

type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

/**
 * Per-game atmosphere. Each preset is a handful of slow, faint particles —
 * enough to make the table feel alive, few enough (a few dozen at a time) to
 * cost nothing next to the cards.
 */
function preset(kind: Ambient, width: number, height: number, unit: number, accent: number): EmitterConfig {
  const across = { min: 0, max: width };
  const s = unit / 32;
  switch (kind) {
    case "motes":
      return {
        x: across,
        y: { min: height * 0.2, max: height * 1.05 },
        speedY: { min: -unit * 0.6, max: -unit * 1.6 },
        speedX: { min: -unit * 0.3, max: unit * 0.3 },
        scale: { start: s * 0.28, end: s * 0.08 },
        alpha: { start: 0.55, end: 0 },
        lifespan: 9000,
        frequency: 380,
        tint: accent,
        blendMode: Phaser.BlendModes.ADD,
      };
    case "snow":
      return {
        x: across,
        y: -unit,
        speedY: { min: unit * 1.2, max: unit * 3 },
        speedX: { min: -unit * 0.6, max: unit * 0.6 },
        scale: { min: s * 0.1, max: s * 0.28 },
        alpha: { start: 0.7, end: 0.1 },
        lifespan: 16000,
        frequency: 260,
      };
    case "bubbles":
      return {
        x: across,
        y: height + unit,
        speedY: { min: -unit * 1.5, max: -unit * 3.2 },
        speedX: { min: -unit * 0.3, max: unit * 0.3 },
        scale: { min: s * 0.15, max: s * 0.45 },
        alpha: { start: 0.3, end: 0 },
        lifespan: 11000,
        frequency: 520,
        tint: accent,
      };
    case "embers":
      return {
        x: across,
        y: height + unit,
        speedY: { min: -unit * 2, max: -unit * 4.5 },
        speedX: { min: -unit * 0.8, max: unit * 0.8 },
        scale: { start: s * 0.22, end: 0 },
        alpha: { start: 0.9, end: 0 },
        lifespan: 7000,
        frequency: 300,
        tint: [accent, 0xff7043],
        blendMode: Phaser.BlendModes.ADD,
      };
    case "sand":
      return {
        x: -unit,
        y: { min: 0, max: height },
        speedX: { min: unit * 2, max: unit * 5 },
        speedY: { min: -unit * 0.4, max: unit * 0.4 },
        scale: { min: s * 0.06, max: s * 0.14 },
        alpha: { start: 0.45, end: 0.1 },
        lifespan: 14000,
        frequency: 200,
        tint: accent,
      };
    case "petals":
      return {
        x: across,
        y: -unit,
        speedY: { min: unit * 1.2, max: unit * 2.6 },
        speedX: { min: unit * 0.4, max: unit * 1.6 },
        rotate: { start: 0, end: 540 },
        scale: { min: s * 0.25, max: s * 0.45 },
        alpha: { start: 0.6, end: 0.2 },
        lifespan: 16000,
        frequency: 700,
        tint: [accent, 0xffffff],
      };
    case "twinkle":
      return {
        x: across,
        y: { min: 0, max: height },
        speed: 0,
        scale: { start: s * 0.3, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 2600,
        frequency: 160,
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
  const texture = theme.ambient === "petals" ? FX.confetti : theme.ambient === "twinkle" ? FX.spark : FX.dot;
  const emitter = scene.add.particles(0, 0, texture, preset(theme.ambient, width, height, unit, theme.accent));
  emitter.setDepth(DEPTH_AMBIENT);
  // Start "mid-scene" so the effect doesn't visibly begin from nothing.
  emitter.fastForward(6000, 50);
  return emitter;
}
