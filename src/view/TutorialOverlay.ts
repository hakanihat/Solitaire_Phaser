import * as Phaser from "phaser";
import type { PileKind } from "../core/layout";
import type { VariantDefinition } from "../core/variant";
import { Button, COLORS, textStyle } from "./ui";
import { uiScale } from "./viewport";

const DEPTH = 1200;

/**
 * Step-by-step "how to play". When given a `spotlight` function it dims the
 * real table and outlines the piles each step talks about, so players learn
 * on the actual layout instead of from abstract text.
 */
export class TutorialOverlay extends Phaser.GameObjects.Container {
  private step = 0;
  private readonly shade: Phaser.GameObjects.Graphics;
  private readonly rings: Phaser.GameObjects.Graphics;
  private readonly card: Phaser.GameObjects.Container;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly nextButton: Button;
  private readonly backButton: Button;
  private ringTween?: Phaser.Tweens.Tween;
  private readonly topY: number;
  private readonly bottomY: number;

  public constructor(
    scene: Phaser.Scene,
    private readonly variant: VariantDefinition,
    private readonly options: {
      spotlight?: (kinds: readonly PileKind[]) => Phaser.Geom.Rectangle[];
      onClose: () => void;
    }
  ) {
    super(scene, 0, 0);
    const { width, height } = scene.scale;
    const ui = uiScale(scene);
    const font = 16 * ui;
    const accent = variant.theme.accent;

    this.shade = scene.add.graphics();
    const blocker = scene.add.zone(0, 0, width, height).setOrigin(0).setInteractive();
    this.rings = scene.add.graphics();

    const cardW = Math.min(width * 0.92, 440 * ui);
    const cardH = font * 12.5;
    this.topY = cardH / 2 + font * 1.2;
    this.bottomY = height - cardH / 2 - font * 1.2;
    this.card = scene.add.container(width / 2, this.bottomY);
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.panel, 0.96).fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, font);
    bg.lineStyle(2, accent, 0.8).strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, font);
    const badge = scene.add
      .text(
        -cardW / 2 + font,
        -cardH / 2 + font * 0.9,
        `HOW TO PLAY · ${variant.name.toUpperCase()}`,
        textStyle(font * 0.72, accent, true)
      )
      .setOrigin(0, 0.5);
    this.counter = scene.add
      .text(cardW / 2 - font, -cardH / 2 + font * 0.9, "", textStyle(font * 0.72, COLORS.muted))
      .setOrigin(1, 0.5);
    this.titleText = scene.add.text(
      -cardW / 2 + font,
      -cardH / 2 + font * 2.2,
      "",
      textStyle(font * 1.35, COLORS.text, true)
    );
    this.bodyText = scene.add.text(-cardW / 2 + font, -cardH / 2 + font * 4.1, "", {
      ...textStyle(font * 0.98, COLORS.text),
      wordWrap: { width: cardW - font * 2 },
      lineSpacing: font * 0.25,
    });
    const buttonY = cardH / 2 - font * 1.8;
    this.backButton = new Button(scene, -cardW / 2 + font * 4.2, buttonY, {
      width: font * 6.5,
      height: font * 2.4,
      label: "Back",
      style: "ghost",
      accent,
      fontSize: font,
      onClick: () => this.show(this.step - 1),
    });
    const skip = new Button(scene, 0, buttonY, {
      width: font * 5.5,
      height: font * 2.4,
      label: "Skip",
      style: "ghost",
      accent,
      fontSize: font,
      onClick: () => this.finish(),
    });
    this.nextButton = new Button(scene, cardW / 2 - font * 4.2, buttonY, {
      width: font * 6.5,
      height: font * 2.4,
      label: "Next",
      style: "primary",
      accent,
      fontSize: font,
      onClick: () => (this.step >= variant.tutorial.length - 1 ? this.finish() : this.show(this.step + 1)),
    });
    this.card.add([bg, badge, this.counter, this.titleText, this.bodyText, this.backButton, skip, this.nextButton]);
    this.add([this.shade, blocker, this.rings, this.card]);
    this.setDepth(DEPTH);
    scene.add.existing(this);

    this.card.setY(this.card.y + cardH).setAlpha(0);
    scene.tweens.add({ targets: this.card, y: this.card.y - cardH, alpha: 1, duration: 320, ease: "Back.easeOut" });
    this.show(0);
  }

  private show(step: number): void {
    const steps = this.variant.tutorial;
    this.step = Phaser.Math.Clamp(step, 0, steps.length - 1);
    const current = steps[this.step];
    this.titleText.setText(current.title);
    this.bodyText.setText(current.text);
    this.counter.setText(`${this.step + 1} / ${steps.length}`);
    this.backButton.setEnabled(this.step > 0);
    this.nextButton.setLabel(this.step === steps.length - 1 ? "Play!" : "Next");
    const holes = this.drawSpotlight(current.highlight ?? []);
    // Keep the explanation clear of the piles it points at.
    const lowest = Math.max(0, ...holes.map((hole) => hole.bottom));
    const targetY = lowest > this.bottomY - this.topY ? this.topY : this.bottomY;
    if (step > 0 && targetY !== this.card.y) {
      this.scene.tweens.add({ targets: this.card, y: targetY, duration: 260, ease: "Cubic.easeInOut" });
    }
    this.bodyText.setAlpha(0);
    this.scene.tweens.add({ targets: this.bodyText, alpha: 1, duration: 220 });
  }

  /** Dims everything except the piles this step is about. */
  private drawSpotlight(kinds: readonly PileKind[]): Phaser.Geom.Rectangle[] {
    const { width, height } = this.scene.scale;
    const holes = kinds.length > 0 && this.options.spotlight ? this.options.spotlight(kinds) : [];
    const pad = Math.min(width, height) * 0.012;
    this.shade.clear();
    this.rings.clear();
    this.ringTween?.stop();
    // Build the dim layer from horizontal bands so highlighted piles stay bright.
    this.shade.fillStyle(0x000000, 0.62);
    if (holes.length === 0) {
      this.shade.fillRect(0, 0, width, height);
      return [];
    }
    const expanded = holes.map(
      (r) => new Phaser.Geom.Rectangle(r.x - pad, r.y - pad, r.width + pad * 2, r.height + pad * 2)
    );
    const edges = [...new Set([0, height, ...expanded.flatMap((r) => [r.top, r.bottom])])].sort((a, b) => a - b);
    for (let i = 0; i < edges.length - 1; i += 1) {
      const top = edges[i];
      const bottom = edges[i + 1];
      const mid = (top + bottom) / 2;
      const spans = expanded.filter((r) => r.top <= mid && r.bottom >= mid).sort((a, b) => a.left - b.left);
      let x = 0;
      for (const span of spans) {
        if (span.left > x) {
          this.shade.fillRect(x, top, span.left - x, bottom - top);
        }
        x = Math.max(x, span.right);
      }
      if (x < width) {
        this.shade.fillRect(x, top, width - x, bottom - top);
      }
    }
    this.rings.lineStyle(Math.max(2, pad * 0.5), this.variant.theme.accent, 1);
    expanded.forEach((r) => this.rings.strokeRoundedRect(r.x, r.y, r.width, r.height, pad));
    this.rings.setAlpha(1);
    this.ringTween = this.scene.tweens.add({ targets: this.rings, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    return expanded;
  }

  private finish(): void {
    this.ringTween?.stop();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.destroy();
        this.options.onClose();
      },
    });
  }
}
