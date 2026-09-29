import * as Phaser from "phaser";
import { Suit } from "../core/cards";
import { FX } from "../scenes/keys";
import { GLOW_TEXTURE } from "./CardView";
import { traceSuit } from "./suits";
import { COLORS, hex, textStyle } from "./ui";

/*
 * Rewarding feedback: suit-symbol bursts when cards go home, golden points,
 * and the victory show. Everything here is purely visual.
 */

const DEPTH = 9000;
const SUIT_CELL = 96;
/** Ruby for hearts and diamonds, gold for clubs and spades (matches the HUD). */
const SUIT_FILL: Record<Suit, string> = {
  [Suit.Hearts]: "#ff4d6d",
  [Suit.Diamonds]: "#ff4d6d",
  [Suit.Clubs]: hex(COLORS.gold),
  [Suit.Spades]: hex(COLORS.gold),
};
const SUIT_EDGE: Record<Suit, string> = {
  [Suit.Hearts]: "#7a0019",
  [Suit.Diamonds]: "#7a0019",
  [Suit.Clubs]: "#6b4a00",
  [Suit.Spades]: "#6b4a00",
};

/**
 * One texture with the four suits as frames 0–3 (in `Suit` order), drawn as
 * vector shapes rather than font glyphs so they look the same everywhere —
 * some Android fonts would otherwise swap ♥ for a colour emoji.
 */
export function createSuitTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FX.suits)) {
    return;
  }
  const texture = scene.textures.createCanvas(FX.suits, SUIT_CELL * 4, SUIT_CELL);
  if (!texture) {
    return;
  }
  const ctx = texture.getContext();
  const r = SUIT_CELL * 0.36;
  [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades].forEach((suit) => {
    ctx.save();
    ctx.translate(suit * SUIT_CELL + SUIT_CELL / 2, SUIT_CELL / 2);
    ctx.shadowColor = SUIT_FILL[suit];
    ctx.shadowBlur = SUIT_CELL * 0.12;
    traceSuit(ctx, suit, r);
    ctx.fillStyle = SUIT_FILL[suit];
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = SUIT_CELL * 0.035;
    ctx.strokeStyle = SUIT_EDGE[suit];
    ctx.stroke();
    // A small highlight gives the symbols a jewel-like sheen.
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.35, r * 0.18, r * 0.1, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    texture.add(suit, 0, suit * SUIT_CELL, 0, SUIT_CELL, SUIT_CELL);
  });
  texture.refresh();
}

const suitEmitters = new WeakMap<Phaser.Scene, Phaser.GameObjects.Particles.ParticleEmitter>();

function suitEmitter(scene: Phaser.Scene, size: number): Phaser.GameObjects.Particles.ParticleEmitter {
  let emitter = suitEmitters.get(scene);
  if (!emitter || !emitter.scene) {
    emitter = scene.add.particles(0, 0, FX.suits, {
      frame: [0, 1, 2, 3],
      speed: { min: size * 1.4, max: size * 3.6 },
      angle: { min: 200, max: 340 },
      gravityY: size * 7,
      rotate: { min: -50, max: 50 },
      scale: { start: size / 150, end: size / 500 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 700, max: 1100 },
      emitting: false,
    });
    emitter.setDepth(DEPTH + 2);
    suitEmitters.set(scene, emitter);
  }
  return emitter;
}

const sparkEmitters = new WeakMap<Phaser.Scene, Phaser.GameObjects.Particles.ParticleEmitter>();

function goldSparks(scene: Phaser.Scene, size: number): Phaser.GameObjects.Particles.ParticleEmitter {
  let emitter = sparkEmitters.get(scene);
  if (!emitter || !emitter.scene) {
    emitter = scene.add.particles(0, 0, FX.spark, {
      speed: { min: size * 0.8, max: size * 3 },
      angle: { min: 0, max: 360 },
      scale: { start: size / 60, end: 0 },
      lifespan: { min: 400, max: 750 },
      tint: [COLORS.gold, 0xffffff, 0xffe9a8],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(DEPTH + 1);
    sparkEmitters.set(scene, emitter);
  }
  return emitter;
}

/**
 * A card arriving home: a golden shockwave, a flash on the card and a
 * fountain of suit symbols led by the card's own suit.
 */
export function foundationBurst(scene: Phaser.Scene, x: number, y: number, suit: Suit, cardWidth: number): void {
  const ring = scene.add.graphics().setDepth(DEPTH).setPosition(x, y);
  ring.lineStyle(Math.max(2, cardWidth * 0.05), COLORS.gold, 1).strokeCircle(0, 0, cardWidth * 0.55);
  ring.setScale(0.3).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: ring,
    scale: 1.9,
    alpha: 0,
    duration: 480,
    ease: "Cubic.easeOut",
    onComplete: () => ring.destroy(),
  });

  const flash = scene.add
    .image(x, y, GLOW_TEXTURE)
    .setDisplaySize(cardWidth * 1.35, cardWidth * 1.9)
    .setTint(COLORS.gold)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    scale: flash.scale * 1.25,
    duration: 420,
    onComplete: () => flash.destroy(),
  });

  const suits = suitEmitter(scene, cardWidth);
  suits.setEmitterFrame(suit);
  suits.explode(7, x, y);
  suits.setEmitterFrame([0, 1, 2, 3], true);
  suits.explode(5, x, y);
  goldSparks(scene, cardWidth).explode(16, x, y);
}

/** Golden points that pop and float up — easy to read on any table. */
export function goldenPoints(scene: Phaser.Scene, x: number, y: number, message: string, size: number): void {
  const text = scene.add
    .text(x, y, message, {
      ...textStyle(size, COLORS.gold, true),
      stroke: "#4a2f00",
      strokeThickness: size * 0.16,
      // Room for the glow, which Phaser would otherwise crop into a box.
      padding: { x: size * 0.6, y: size * 0.6 },
    })
    .setOrigin(0.5)
    .setDepth(DEPTH + 5)
    .setScale(0.3);
  text.setShadow(0, 0, hex(COLORS.gold), size * 0.5, true, true);
  scene.tweens.add({ targets: text, scale: 1.15, duration: 200, ease: "Back.easeOut" });
  scene.tweens.add({ targets: text, scale: 1, delay: 200, duration: 140 });
  scene.tweens.add({
    targets: text,
    y: y - size * 2.4,
    alpha: 0,
    delay: 520,
    duration: 700,
    ease: "Quad.easeIn",
    onComplete: () => text.destroy(),
  });
}

/** Sunburst rays drawn once, then rotated. */
function rays(scene: Phaser.Scene, x: number, y: number, radius: number): Phaser.GameObjects.Graphics {
  const g = scene.add
    .graphics()
    .setPosition(x, y)
    .setDepth(DEPTH - 5)
    .setBlendMode(Phaser.BlendModes.ADD);
  const count = 18;
  g.fillStyle(COLORS.gold, 0.16);
  for (let i = 0; i < count; i += 1) {
    const a0 = (i / count) * Math.PI * 2;
    const a1 = a0 + Math.PI / count;
    g.fillTriangle(0, 0, Math.cos(a0) * radius, Math.sin(a0) * radius, Math.cos(a1) * radius, Math.sin(a1) * radius);
  }
  return g;
}

export interface VictoryShow {
  /** Lifts the banner out of the way and softens the rays (results panel opening). */
  calm(): void;
  dispose(): void;
}

/**
 * The victory show: a flash, rotating golden rays behind a "YOU WIN!" banner,
 * and fireworks made of suit symbols.
 */
export function victoryShow(scene: Phaser.Scene, fontSize: number): VictoryShow {
  const { width, height } = scene.scale;
  const centreY = height * 0.34;
  const objects: Phaser.GameObjects.GameObject[] = [];

  const flash = scene.add
    .rectangle(0, 0, width, height, 0xffffff, 0.55)
    .setOrigin(0)
    .setDepth(DEPTH + 10);
  scene.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });

  const burst = rays(scene, width / 2, centreY, Math.hypot(width, height) * 0.6).setScale(0);
  scene.tweens.add({ targets: burst, scale: 1, duration: 700, ease: "Cubic.easeOut" });
  scene.tweens.add({ targets: burst, angle: 360, duration: 26000, repeat: -1 });
  objects.push(burst);

  const banner = scene.add
    .text(width / 2, centreY, "YOU WIN!", {
      ...textStyle(fontSize * 3.2, COLORS.gold, true),
      stroke: "#4a2f00",
      strokeThickness: fontSize * 0.45,
      padding: { x: fontSize * 1.4, y: fontSize * 1.4 },
    })
    .setOrigin(0.5)
    .setDepth(DEPTH + 8)
    .setScale(0);
  banner.setShadow(0, 0, hex(COLORS.gold), fontSize * 1.2, true, true);
  scene.tweens.add({ targets: banner, scale: 1, duration: 650, delay: 150, ease: "Back.easeOut" });
  scene.tweens.add({
    targets: banner,
    scale: 1.06,
    duration: 900,
    delay: 800,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  objects.push(banner);

  // Fireworks: bursts of suit symbols and gold sparks around the banner.
  const fireworks = scene.add.particles(0, 0, FX.suits, {
    frame: [0, 1, 2, 3],
    speed: { min: fontSize * 3, max: fontSize * 9 },
    angle: { min: 0, max: 360 },
    gravityY: fontSize * 8,
    rotate: { min: -120, max: 120 },
    scale: { start: fontSize / 55, end: fontSize / 220 },
    alpha: { start: 1, end: 0 },
    lifespan: { min: 900, max: 1500 },
    emitting: false,
  });
  fireworks.setDepth(DEPTH + 6);
  const sparks = scene.add.particles(0, 0, FX.spark, {
    speed: { min: fontSize * 2, max: fontSize * 8 },
    angle: { min: 0, max: 360 },
    scale: { start: fontSize / 24, end: 0 },
    lifespan: { min: 500, max: 1000 },
    tint: [COLORS.gold, 0xffffff, 0xffe9a8],
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  });
  sparks.setDepth(DEPTH + 7);
  objects.push(fireworks, sparks);
  let shots = 0;
  const launcher = scene.time.addEvent({
    delay: 330,
    loop: true,
    callback: () => {
      const x = width * (0.15 + Math.random() * 0.7);
      const y = height * (0.12 + Math.random() * 0.45);
      fireworks.explode(18, x, y);
      sparks.explode(24, x, y);
      shots += 1;
      if (shots >= 14) {
        launcher.remove();
      }
    },
  });

  return {
    calm: () => {
      scene.tweens.killTweensOf(banner);
      scene.tweens.add({ targets: banner, y: height * 0.1, scale: 0.7, duration: 450, ease: "Cubic.easeInOut" });
      scene.tweens.add({ targets: burst, alpha: 0.4, duration: 450 });
    },
    dispose: () => {
      launcher.remove();
      objects.forEach((object) => {
        scene.tweens.killTweensOf(object);
        object.destroy();
      });
    },
  };
}
