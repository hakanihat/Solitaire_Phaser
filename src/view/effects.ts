import * as Phaser from "phaser";
import { FX } from "../scenes/keys";
import type { CardView } from "./CardView";
import { EFFECT_PADDING_RATIO, GLOW_TEXTURE } from "./CardView";

const DEPTH_EFFECTS = 9000;

/** Pulsing glow outlines over cards (hint source, selection). Returns a disposer. */
export function glowCards(scene: Phaser.Scene, cards: readonly CardView[], color: number): () => void {
  const glows = cards.map((card) =>
    scene.add
      .image(card.x, card.y, GLOW_TEXTURE)
      .setDisplaySize(card.displayWidth * EFFECT_PADDING_RATIO, card.displayHeight * EFFECT_PADDING_RATIO * 0.98)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(card.depth + 0.5)
      .setAlpha(0.2)
  );
  const tween = scene.tweens.add({
    targets: glows,
    alpha: 1,
    duration: 420,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  return () => {
    tween.stop();
    glows.forEach((glow) => glow.destroy());
  };
}

/**
 * Semi-transparent copies of `cards` that glide to `target` and fade, showing
 * where the hinted move goes. Repeats a couple of times. Returns a disposer.
 */
export function ghostMove(
  scene: Phaser.Scene,
  cards: readonly CardView[],
  target: Phaser.Math.Vector2,
  spacing: number
): () => void {
  const first = cards[0];
  const ghosts = cards.map((card, i) =>
    scene.add
      .image(card.x, card.y, card.texture.key, card.frame.name)
      .setDisplaySize(card.displayWidth, card.displayHeight)
      .setAlpha(0)
      .setDepth(DEPTH_EFFECTS - 10 + i)
  );
  const run = (): void => {
    ghosts.forEach((ghost, i) => {
      ghost.setPosition(cards[i].x, cards[i].y).setAlpha(0.75);
      scene.tweens.add({
        targets: ghost,
        x: target.x + (cards[i].x - first.x),
        y: target.y + i * spacing,
        duration: 650,
        ease: "Cubic.easeInOut",
      });
      scene.tweens.add({ targets: ghost, alpha: 0, delay: 700, duration: 250 });
    });
  };
  run();
  const timer = scene.time.addEvent({ delay: 1300, callback: run, repeat: 1 });
  return () => {
    timer.remove();
    ghosts.forEach((ghost) => {
      scene.tweens.killTweensOf(ghost);
      ghost.destroy();
    });
  };
}

/** Falling confetti in the theme colours. */
export function confetti(scene: Phaser.Scene, colors: readonly number[]): Phaser.GameObjects.Particles.ParticleEmitter {
  const { width } = scene.scale;
  const emitter = scene.add.particles(0, -20, FX.confetti, {
    x: { min: 0, max: width },
    speedY: { min: width * 0.15, max: width * 0.4 },
    speedX: { min: -width * 0.08, max: width * 0.08 },
    rotate: { start: 0, end: 720 },
    scale: { min: width / 900, max: width / 500 },
    lifespan: 4200,
    frequency: 24,
    tint: [...colors],
  });
  emitter.setDepth(DEPTH_EFFECTS);
  return emitter;
}

/**
 * The classic solitaire victory: cards leap off the table one by one and
 * bounce away, stamping trails behind them. Returns a disposer.
 */
export function bouncingCascade(scene: Phaser.Scene, cards: readonly CardView[]): () => void {
  const { width, height } = scene.scale;
  const trails = scene.add
    .renderTexture(0, 0, width, height)
    .setOrigin(0)
    .setDepth(DEPTH_EFFECTS - 20);
  const gravity = height * 1.8;
  const launched: { card: CardView; vx: number; vy: number }[] = [];
  let next = 0;
  const launcher = scene.time.addEvent({
    delay: 110,
    loop: true,
    callback: () => {
      const card = cards[next % cards.length];
      next += 1;
      if (next > cards.length * 2) {
        launcher.remove();
        return;
      }
      card.setDepth(DEPTH_EFFECTS - 15);
      launched.push({
        card,
        vx: (Math.random() < 0.5 ? -1 : 1) * width * (0.25 + Math.random() * 0.35),
        vy: -height * Math.random() * 0.6,
      });
    },
  });
  const step = (_time: number, delta: number): void => {
    const dt = Math.min(delta, 40) / 1000;
    for (const flyer of launched) {
      const { card } = flyer;
      flyer.vy += gravity * dt;
      card.x += flyer.vx * dt;
      card.y += flyer.vy * dt;
      if (card.y + card.displayHeight / 2 > height) {
        card.y = height - card.displayHeight / 2;
        flyer.vy *= -0.72;
      }
      trails.draw(card);
    }
    // Retire cards that left the screen so the loop stays cheap.
    for (let i = launched.length - 1; i >= 0; i -= 1) {
      const { card } = launched[i];
      if (card.x < -card.displayWidth || card.x > width + card.displayWidth) {
        card.setVisible(false);
        launched.splice(i, 1);
      }
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  return () => {
    launcher.remove();
    scene.events.off(Phaser.Scenes.Events.UPDATE, step);
    trails.destroy();
  };
}
