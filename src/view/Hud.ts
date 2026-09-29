import type * as Phaser from "phaser";
import type { Difficulty } from "../core/Rules";
import type { VariantDefinition } from "../core/variant";
import { formatTime } from "../scenes/format";
import type { Area } from "./BoardView";
import type { IconName } from "./icons";
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

/**
 * Top bar (navigation, title, live stats) and bottom toolbar (actions).
 * Primary actions sit at the bottom where thumbs reach on a phone.
 */
export class Hud {
  public readonly tableArea: Area;
  public readonly undoButton: Button;
  public readonly hintButton: Button;
  public readonly autoButton: Button;
  private readonly stats: Phaser.GameObjects.Text;
  private readonly objects: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth)[] = [];

  public constructor(scene: Phaser.Scene, variant: VariantDefinition, difficulty: Difficulty, actions: HudActions) {
    const { width, height } = scene.scale;
    const ui = uiScale(scene);
    const font = 16 * ui;
    const accent = variant.theme.accent;
    const topH = font * 4.2;
    const toolbarH = font * 4.6;

    const topBar = scene.add.graphics();
    topBar
      .fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.45, 0.45, 0, 0)
      .fillRect(0, 0, width, topH * 1.15);
    const bottomBar = scene.add.graphics();
    bottomBar.fillStyle(0x000000, 0.35).fillRect(0, height - toolbarH, width, toolbarH);
    bottomBar.lineStyle(1, 0xffffff, 0.08).lineBetween(0, height - toolbarH, width, height - toolbarH);
    this.objects.push(topBar, bottomBar);

    const square = font * 2.7;
    const home = new Button(scene, font * 0.6 + square / 2, font * 0.5 + square / 2, {
      width: square,
      height: square,
      icon: "home",
      style: "ghost",
      accent,
      fontSize: font,
      onClick: actions.home,
    });
    const help = new Button(scene, width - font * 0.6 - square / 2, font * 0.5 + square / 2, {
      width: square,
      height: square,
      icon: "help",
      style: "ghost",
      accent,
      fontSize: font,
      onClick: actions.help,
    });
    const title = scene.add
      .text(
        width / 2,
        font * 1.35,
        `${variant.name} · ${variant.difficulties[difficulty].label}`,
        textStyle(font * 1.05, COLORS.text, true)
      )
      .setOrigin(0.5);
    this.stats = scene.add.text(width / 2, font * 2.85, "", textStyle(font * 0.82, COLORS.muted)).setOrigin(0.5);
    this.objects.push(home, help, title, this.stats);

    const slot = width / 4;
    const y = height - toolbarH / 2;
    const toolbar = (index: number, icon: IconName, label: string, onClick: () => void): Button =>
      new Button(scene, slot * (index + 0.5), y, {
        width: slot * 0.9,
        height: toolbarH * 0.9,
        icon,
        label,
        style: "toolbar",
        accent,
        fontSize: font,
        onClick,
      });
    const newDeal = toolbar(0, "deal", "New", actions.newDeal);
    const settings = toolbar(1, "gear", "Settings", actions.settings);
    this.hintButton = toolbar(2, "hint", "Hint", actions.hint);
    this.undoButton = toolbar(3, "undo", "Undo", actions.undo);
    this.objects.push(newDeal, settings, this.hintButton, this.undoButton);

    // Auto-finish appears as a floating pill only when it can be used.
    this.autoButton = new Button(scene, width / 2, height - toolbarH - font * 2.2, {
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

    this.tableArea = { x: 0, y: topH, width, height: height - topH - toolbarH };
  }

  public update(stats: HudStats): void {
    const parts = [`Moves ${stats.moves}`, `Score ${stats.score}`];
    if (stats.showTimer) {
      parts.unshift(formatTime(stats.time));
    }
    this.stats.setText(parts.join("   ·   "));
  }

  public setAutoVisible(visible: boolean): void {
    if (visible === this.autoButton.visible) {
      return;
    }
    this.autoButton.setVisible(visible).setPulse(visible);
  }

  public destroy(): void {
    this.objects.forEach((object) => object.destroy());
  }
}
