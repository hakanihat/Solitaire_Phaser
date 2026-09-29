import type * as Phaser from "phaser";
import type { Difficulty } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import { formatTime } from "../scenes/format";
import type { Area } from "./BoardView";
import { drawIcon, type IconName } from "./icons";
import { Button, COLORS, textStyle } from "./ui";
import { uiScale } from "./viewport";

export interface HudActions {
  readonly home: () => void;
  readonly help: () => void;
  readonly undo: () => void;
  readonly hint: () => void;
  readonly auto: () => void;
  readonly newDeal: () => void;
  readonly settings: () => void;
}

export interface HudStats {
  readonly time: number;
  readonly moves: number;
  readonly score: number;
  readonly showTimer: boolean;
}

const DEPTH = 700;
/** Frosted-glass look shared by the stats pill and the dock. */
const GLASS_FILL = 0x0a0f16;
const GLASS_ALPHA = 0.5;

interface Chip {
  readonly container: Phaser.GameObjects.Container;
  readonly text: Phaser.GameObjects.Text;
}

/**
 * Header (navigation, title, live stats) and a floating dock of actions.
 * Primary actions sit at the bottom where thumbs reach on a phone.
 */
export class Hud {
  public readonly tableArea: Area;
  public readonly undoButton: Button;
  public readonly hintButton: Button;
  public readonly autoButton: Button;
  private readonly objects: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth)[] = [];
  private readonly time: Chip;
  private readonly moves: Chip;
  private readonly score: Chip;
  private shownScore = 0;
  private scoreTween?: Phaser.Tweens.Tween;

  public constructor(
    private readonly scene: Phaser.Scene,
    variant: VariantDefinition,
    difficulty: Difficulty,
    actions: HudActions
  ) {
    const { width, height } = scene.scale;
    const font = 16 * uiScale(scene);
    const accent = variant.theme.accent;
    const headerH = font * 5;
    const dockH = font * 4.4;
    const dockMargin = font * 0.6;

    // Header: a soft dark fade so text stays readable over any table.
    const shade = scene.add.graphics();
    shade
      .fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.5, 0.5, 0, 0)
      .fillRect(0, 0, width, headerH * 1.2);
    this.objects.push(shade);

    const button = font * 2.7;
    const round = (x: number, icon: IconName, onClick: () => void): Button =>
      new Button(scene, x, font * 0.6 + button / 2, {
        width: button,
        height: button,
        icon,
        style: "ghost",
        accent,
        fontSize: font,
        onClick,
      });
    this.objects.push(
      round(font * 0.7 + button / 2, "home", actions.home),
      round(width - font * 0.7 - button / 2, "help", actions.help)
    );

    const title = scene.add
      .text(width / 2, font * 1.15, variant.name.toUpperCase(), textStyle(font * 0.95, accent, true))
      .setOrigin(0.5)
      .setLetterSpacing(font * 0.12);
    const subtitle = scene.add
      .text(width / 2, font * 2.15, variant.difficulties[difficulty].label, textStyle(font * 0.72, COLORS.muted))
      .setOrigin(0.5);
    this.objects.push(title, subtitle);

    // Stats pill: time · moves · score, each with an icon.
    const pillW = Math.min(width - button * 2 - font * 3, font * 16);
    const pillH = font * 1.9;
    const pillY = font * 3.75;
    const pill = scene.add.graphics();
    pill
      .fillStyle(GLASS_FILL, GLASS_ALPHA)
      .fillRoundedRect(width / 2 - pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2);
    pill
      .lineStyle(1, 0xffffff, 0.12)
      .strokeRoundedRect(width / 2 - pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2);
    this.objects.push(pill);
    const chip = (index: number, icon: IconName): Chip => {
      const x = width / 2 + (index - 1) * (pillW / 3);
      const container = scene.add.container(x, pillY);
      const text = scene.add.text(font * 0.2, 0, "", textStyle(font * 0.85, COLORS.text, true)).setOrigin(0, 0.5);
      container.add([drawIcon(scene, icon, font * 0.95, accent).setPosition(-font * 0.55, 0), text]);
      this.objects.push(container);
      return { container, text };
    };
    this.time = chip(0, "clock");
    this.moves = chip(1, "moves");
    this.score = chip(2, "star");

    // Floating dock.
    const dockW = width - dockMargin * 2;
    const dockTop = height - dockMargin - dockH;
    const dock = scene.add.graphics();
    dock.fillStyle(0x000000, 0.25).fillRoundedRect(dockMargin, dockTop + font * 0.2, dockW, dockH, font * 1.3);
    dock.fillStyle(GLASS_FILL, 0.72).fillRoundedRect(dockMargin, dockTop, dockW, dockH, font * 1.3);
    dock.lineStyle(1, 0xffffff, 0.12).strokeRoundedRect(dockMargin, dockTop, dockW, dockH, font * 1.3);
    this.objects.push(dock);
    const slot = dockW / 4;
    const tool = (index: number, icon: IconName, label: string, onClick: () => void): Button =>
      new Button(scene, dockMargin + slot * (index + 0.5), dockTop + dockH / 2, {
        width: slot * 0.92,
        height: dockH * 0.9,
        icon,
        label,
        style: "toolbar",
        accent,
        fontSize: font,
        onClick,
      });
    const newDeal = tool(0, "deal", "New", actions.newDeal);
    const settings = tool(1, "gear", "Settings", actions.settings);
    this.hintButton = tool(2, "hint", "Hint", actions.hint);
    this.undoButton = tool(3, "undo", "Undo", actions.undo);
    this.objects.push(newDeal, settings, this.hintButton, this.undoButton);

    // Auto-finish appears as a floating pill only when it can be used.
    this.autoButton = new Button(scene, width / 2, dockTop - font * 2.1, {
      width: font * 10,
      height: font * 2.8,
      icon: "magic",
      label: "Auto finish",
      style: "primary",
      accent,
      fontSize: font,
      onClick: actions.auto,
    });
    this.autoButton.setVisible(false);
    this.objects.push(this.autoButton);
    this.objects.forEach((object) => object.setDepth(DEPTH));

    this.tableArea = { x: 0, y: headerH, width, height: dockTop - headerH - font * 0.3 };
  }

  public update(stats: HudStats): void {
    this.time.text.setText(stats.showTimer ? formatTime(stats.time) : "–:––");
    this.moves.text.setText(String(stats.moves));
    this.setScore(stats.score);
  }

  public setAutoVisible(visible: boolean): void {
    if (visible === this.autoButton.visible) {
      return;
    }
    this.autoButton.setVisible(visible).setPulse(visible);
    if (visible) {
      this.autoButton.setAlpha(0);
      this.scene.tweens.add({ targets: this.autoButton, alpha: 1, duration: 200 });
    }
  }

  public destroy(): void {
    this.scoreTween?.stop();
    this.objects.forEach((object) => object.destroy());
  }

  /** Counts the score up (or down after an undo) and pops the chip. */
  private setScore(score: number): void {
    if (score === this.shownScore && this.score.text.text !== "") {
      return;
    }
    this.scoreTween?.stop();
    const counter = { value: this.shownScore };
    this.shownScore = score;
    if (counter.value === score) {
      this.score.text.setText(String(score));
      return;
    }
    this.scoreTween = this.scene.tweens.add({
      targets: counter,
      value: score,
      duration: 450,
      ease: "Cubic.easeOut",
      onUpdate: () => this.score.text.setText(String(Math.round(counter.value))),
    });
    if (score > counter.value) {
      this.score.container.setScale(1);
      this.scene.tweens.add({
        targets: this.score.container,
        scale: 1.18,
        duration: 110,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    }
  }
}
