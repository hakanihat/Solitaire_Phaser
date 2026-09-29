import * as Phaser from "phaser";
import { createCards, Suit } from "../core/cards";
import { DIFFICULTIES, type Difficulty } from "../core/Rules";
import type { VariantDefinition, VariantTheme } from "../core/variant";
import { storage } from "../services/storage";
import { VARIANTS } from "../variants";
import { CARD_ASPECT, CARD_TEXTURE, frameOf } from "../view/CardView";
import { openSettings } from "../view/SettingsPanel";
import { paintTable, pruneTables } from "../view/tablePainter";
import { TutorialOverlay } from "../view/TutorialOverlay";
import { Button, COLORS, Modal, textStyle } from "../view/ui";
import { drawIcon } from "../view/icons";
import { uiScale } from "../view/viewport";
import { formatTime } from "./format";
import { type LoadingData, SceneKey } from "./keys";

const LOBBY_THEME: VariantTheme = { table: [0x1d4a6b, 0x0a1826], accent: 0xffd166, pattern: "felt", intro: "fan" };
const DECK = createCards(52);
/** Signature cards shown on each game's tile, as [suit, rank]. */
const TILE_CARDS: Record<string, readonly (readonly [Suit, number])[]> = {
  klondike: [
    [Suit.Spades, 13],
    [Suit.Hearts, 12],
    [Suit.Clubs, 11],
  ],
  spider: [
    [Suit.Spades, 13],
    [Suit.Spades, 12],
    [Suit.Spades, 11],
  ],
  freecell: [
    [Suit.Diamonds, 1],
    [Suit.Clubs, 2],
    [Suit.Hearts, 3],
  ],
  pyramid: [
    [Suit.Hearts, 6],
    [Suit.Clubs, 7],
    [Suit.Diamonds, 13],
  ],
  tripeaks: [
    [Suit.Clubs, 8],
    [Suit.Hearts, 9],
    [Suit.Spades, 10],
  ],
  golf: [
    [Suit.Diamonds, 4],
    [Suit.Spades, 5],
    [Suit.Hearts, 4],
  ],
  yukon: [
    [Suit.Clubs, 13],
    [Suit.Diamonds, 12],
    [Suit.Spades, 11],
  ],
  scorpion: [
    [Suit.Hearts, 13],
    [Suit.Hearts, 12],
    [Suit.Hearts, 11],
  ],
  meridian: [
    [Suit.Hearts, 1],
    [Suit.Hearts, 13],
    [Suit.Hearts, 7],
  ],
  gemini: [
    [Suit.Spades, 7],
    [Suit.Diamonds, 8],
    [Suit.Clubs, 6],
  ],
};

export class MenuScene extends Phaser.Scene {
  private page!: Phaser.GameObjects.Container;
  private pageHeight = 0;
  private dragStart: { pointerY: number; pageY: number } | null = null;
  /** True once the current gesture moved far enough to count as a scroll. */
  private scrolled = false;

  public constructor() {
    super(SceneKey.Menu);
  }

  public create(): void {
    const { width, height } = this.scale;
    const ui = uiScale(this);
    const font = 16 * ui;
    const tableKey = paintTable(this, LOBBY_THEME, "menu", width, height);
    pruneTables(this, tableKey);
    this.add.image(0, 0, tableKey).setOrigin(0).setScrollFactor(0);

    this.page = this.add.container(0, 0);
    let y = this.buildHeader(font);
    y = this.buildResume(y, font);
    this.pageHeight = this.buildGrid(y, font) + font * 2;

    const gear = new Button(this, width - font * 2.2, font * 2.4, {
      width: font * 2.8,
      height: font * 2.8,
      icon: "gear",
      style: "ghost",
      accent: LOBBY_THEME.accent,
      fontSize: font,
      onClick: () => openSettings(this, LOBBY_THEME.accent),
    });
    gear.setDepth(50);

    this.enableScrolling(font);
    this.scale.once(Phaser.Scale.Events.RESIZE, () => this.scene.restart());
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private buildHeader(font: number): number {
    const { width } = this.scale;
    const cardW = font * 3.2;
    // A small fan of the real cards, drifting gently, as the logo.
    const fan: [Suit, number][] = [
      [Suit.Clubs, 11],
      [Suit.Diamonds, 12],
      [Suit.Spades, 13],
      [Suit.Hearts, 1],
    ];
    fan.forEach(([suit, rank], i) => {
      const card = DECK.find((c) => c.suit === suit && c.rank === rank);
      if (!card) {
        return;
      }
      const angle = (i - 1.5) * 12;
      const sprite = this.add
        .image(width / 2 + (i - 1.5) * cardW * 0.42, font * 5.2, CARD_TEXTURE, frameOf(card))
        .setDisplaySize(cardW, cardW * CARD_ASPECT)
        .setOrigin(0.5, 0.9)
        .setAngle(angle);
      this.page.add(sprite);
      this.tweens.add({
        targets: sprite,
        angle: angle * 1.25,
        duration: 1800 + i * 150,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
    const title = this.add
      .text(width / 2, font * 7.3, "Solitaire", textStyle(font * 2.6, COLORS.text, true))
      .setOrigin(0.5);
    title.setShadow(0, font * 0.15, "#000000", font * 0.4, false, true);
    const subtitle = this.add
      .text(
        width / 2,
        font * 9.2,
        `COLLECTION · ${VARIANTS.length} GAMES`,
        textStyle(font * 0.8, LOBBY_THEME.accent, true)
      )
      .setOrigin(0.5)
      .setLetterSpacing(font * 0.2);
    this.page.add([title, subtitle]);
    return font * 10.8;
  }

  private buildResume(y: number, font: number): number {
    const saved = storage.savedGame();
    const variant = saved ? VARIANTS.find((candidate) => candidate.id === saved.variant) : undefined;
    if (!saved || !variant) {
      return y;
    }
    const { width } = this.scale;
    const button = new Button(this, width / 2, y + font * 1.5, {
      width: Math.min(width * 0.9, font * 24),
      height: font * 3,
      icon: "play",
      label: `Continue ${variant.name} · ${variant.difficulties[saved.difficulty].label}`,
      style: "primary",
      accent: variant.theme.accent,
      fontSize: font,
      onClick: () => this.launch({ variant: variant.id, difficulty: saved.difficulty, resume: true }),
    });
    this.page.add(button);
    return y + font * 4;
  }

  private buildGrid(top: number, font: number): number {
    const { width } = this.scale;
    const margin = font;
    const columns = Phaser.Math.Clamp(Math.floor(width / (font * 11)), 2, 5);
    const tileW = (width - margin * (columns + 1)) / columns;
    const tileH = Math.max(tileW * 0.68, font * 7.5);
    VARIANTS.forEach((variant, i) => {
      const x = margin + (i % columns) * (tileW + margin) + tileW / 2;
      const y = top + Math.floor(i / columns) * (tileH + margin) + tileH / 2;
      this.page.add(this.buildTile(variant, x, y, tileW, tileH, font));
    });
    return top + Math.ceil(VARIANTS.length / columns) * (tileH + margin);
  }

  private buildTile(
    variant: VariantDefinition,
    x: number,
    y: number,
    w: number,
    h: number,
    font: number
  ): Phaser.GameObjects.Container {
    const tile = this.add.container(x, y);
    const { accent } = variant.theme;
    const radius = font * 0.8;
    // Each tile is a miniature of the game's own table.
    const shadow = this.add
      .graphics()
      .fillStyle(0x000000, 0.3)
      .fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, radius);
    const face = this.add.image(0, 0, paintTable(this, variant.theme, `tile_${variant.id}`, w, h, radius));
    const rim = this.add
      .graphics()
      .lineStyle(2, accent, 0.55)
      .strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    tile.add([shadow, face, rim]);

    const cardW = h * 0.34;
    (TILE_CARDS[variant.id] ?? []).forEach(([suit, rank], i) => {
      const card = DECK.find((c) => c.suit === suit && c.rank === rank);
      if (card) {
        tile.add(
          this.add
            .image(w / 2 - cardW * 1.45 + i * cardW * 0.5, -h * 0.1, CARD_TEXTURE, frameOf(card))
            .setDisplaySize(cardW, cardW * CARD_ASPECT)
            .setAngle((i - 1) * 12)
        );
      }
    });

    // Text is stacked from the bottom edge so long taglines never overflow.
    const tagline = this.add
      .text(-w / 2 + font * 0.8, h / 2 - font * 0.7, variant.tagline, {
        ...textStyle(font * 0.72, COLORS.muted),
        wordWrap: { width: w - font * 1.6 },
      })
      .setOrigin(0, 1);
    const name = this.add
      .text(
        -w / 2 + font * 0.8,
        tagline.y - tagline.height - font * 0.1,
        variant.name,
        textStyle(font * 1.2, COLORS.text, true)
      )
      .setOrigin(0, 1);
    name.setShadow(0, 2, "#000000", 4, false, true);
    tagline.setShadow(0, 1, "#000000", 3, false, true);
    tile.add([name, tagline]);

    if (variant.original) {
      const badge = this.add.text(-w / 2 + font * 0.7, -h / 2 + font * 0.7, "ORIGINAL", {
        ...textStyle(font * 0.62, 0x1d1d2b, true),
        backgroundColor: `#${accent.toString(16).padStart(6, "0")}`,
        padding: { x: font * 0.4, y: font * 0.15 },
      });
      tile.add(badge);
    }
    const wins = storage.totalWins(variant.id);
    if (wins > 0) {
      const trophy = drawIcon(this, "trophy", font * 0.9, accent).setPosition(
        -w / 2 + font * 1.1,
        -h / 2 + (variant.original ? font * 2.4 : font * 1.1)
      );
      const count = this.add
        .text(trophy.x + font * 0.7, trophy.y, String(wins), textStyle(font * 0.75, COLORS.text, true))
        .setOrigin(0, 0.5);
      tile.add([trophy, count]);
    }

    tile.setSize(w, h).setInteractive({ useHandCursor: true });
    tile.on(Phaser.Input.Events.POINTER_DOWN, () => this.tweens.add({ targets: tile, scale: 0.96, duration: 80 }));
    tile.on(Phaser.Input.Events.POINTER_OUT, () => this.tweens.add({ targets: tile, scale: 1, duration: 120 }));
    tile.on(Phaser.Input.Events.POINTER_UP, () => {
      this.tweens.add({ targets: tile, scale: 1, duration: 150, ease: "Back.easeOut" });
      if (!this.scrolled) {
        this.openVariant(variant, font);
      }
    });
    return tile;
  }

  /** Game details: difficulty choice with personal stats, how-to-play, play. */
  private openVariant(variant: VariantDefinition, font: number): void {
    const { width } = this.scale;
    const accent = variant.theme.accent;
    const panelW = Math.min(width * 0.94, font * 26);
    const rowH = font * 4.3;
    const rowsTop = font * 5.6;
    const panelH = rowsTop + rowH * DIFFICULTIES.length + font * 5;
    const modal = new Modal(this, {
      width: panelW,
      height: panelH,
      title: variant.name,
      titleSize: font * 1.6,
      accent,
    });
    const tagline = this.add
      .text(0, -panelH / 2 + font * 3.7, variant.tagline, textStyle(font * 0.9, COLORS.muted))
      .setOrigin(0.5);
    modal.panel.add(tagline);

    let selected: Difficulty = storage.lastDifficulty(variant.id);
    const rows: Phaser.GameObjects.Graphics[] = [];
    const paintRows = (): void =>
      rows.forEach((g, i) => {
        const on = DIFFICULTIES[i] === selected;
        g.clear();
        g.fillStyle(on ? accent : 0xffffff, on ? 0.22 : 0.06).fillRoundedRect(
          -panelW / 2 + font,
          -rowH / 2 + font * 0.2,
          panelW - font * 2,
          rowH - font * 0.4,
          font * 0.6
        );
        if (on) {
          g.lineStyle(2, accent, 1).strokeRoundedRect(
            -panelW / 2 + font,
            -rowH / 2 + font * 0.2,
            panelW - font * 2,
            rowH - font * 0.4,
            font * 0.6
          );
        }
      });
    DIFFICULTIES.forEach((difficulty, i) => {
      const info = variant.difficulties[difficulty];
      const stats = storage.stats(variant.id, difficulty);
      const row = this.add.container(0, -panelH / 2 + rowsTop + rowH / 2 + i * rowH);
      const g = this.add.graphics();
      rows.push(g);
      const level = ["Easy", "Medium", "Hard"][i];
      const heading = this.add
        .text(-panelW / 2 + font * 1.8, -font * 0.2, `${level} · ${info.label}`, textStyle(font, COLORS.text, true))
        .setOrigin(0, 1);
      const record =
        stats.played > 0
          ? `${stats.won}/${stats.played} won${stats.bestTime !== null ? `\nbest ${formatTime(stats.bestTime)}` : ""}`
          : "";
      const detail = this.add.text(-panelW / 2 + font * 1.8, -font * 0.05, info.detail, {
        ...textStyle(font * 0.72, COLORS.muted),
        wordWrap: { width: panelW - font * 3.6 - (record ? font * 5.5 : 0) },
      });
      const statText = this.add
        .text(panelW / 2 - font * 1.8, 0, record, { ...textStyle(font * 0.7, COLORS.muted), align: "right" })
        .setOrigin(1, 0.5);
      const hit = this.add.zone(0, 0, panelW - font * 2, rowH).setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.POINTER_UP, () => {
        selected = difficulty;
        paintRows();
      });
      row.add([g, heading, detail, statText, hit]);
      modal.panel.add(row);
    });
    paintRows();

    const buttonY = panelH / 2 - font * 2.4;
    const howTo = new Button(this, -panelW / 4, buttonY, {
      width: panelW * 0.42,
      height: font * 2.8,
      icon: "help",
      label: "How to play",
      style: "ghost",
      accent,
      fontSize: font * 0.9,
      onClick: () => new TutorialOverlay(this, variant, { onClose: () => undefined }),
    });
    const play = new Button(this, panelW / 4, buttonY, {
      width: panelW * 0.42,
      height: font * 2.8,
      icon: "play",
      label: "Play",
      style: "primary",
      accent,
      fontSize: font,
      onClick: () => {
        storage.setLastDifficulty(variant.id, selected);
        modal.close(() => this.launch({ variant: variant.id, difficulty: selected }));
      },
    });
    modal.panel.add([howTo, play]);
  }

  private launch(data: LoadingData): void {
    const saved = storage.savedGame();
    if (!data.resume && saved) {
      // Starting something new abandons the unfinished game.
      storage.recordAbandon(saved.variant, saved.difficulty);
      storage.clearSavedGame();
    }
    this.input.enabled = false;
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(SceneKey.Loading, data)
    );
  }

  /** Drag / wheel scrolling for when the tiles don't fit on screen. */
  private enableScrolling(font: number): void {
    const minY = Math.min(0, this.scale.height - this.pageHeight);
    const clampY = (value: number): number => Phaser.Math.Clamp(value, minY, 0);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.overlayOpen()) {
        return;
      }
      this.dragStart = { pointerY: pointer.y, pageY: this.page.y };
      this.scrolled = false;
      this.tweens.killTweensOf(this.page);
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.dragStart || !pointer.isDown) {
        return;
      }
      const dy = pointer.y - this.dragStart.pointerY;
      if (Math.abs(dy) > font * 0.6) {
        this.scrolled = true;
      }
      if (this.scrolled) {
        this.page.y = clampY(this.dragStart.pageY + dy);
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (this.scrolled) {
        // Carry a little momentum, like native scrolling.
        const velocity = pointer.velocity.y;
        this.tweens.add({
          targets: this.page,
          y: clampY(this.page.y + velocity * 8),
          duration: 400,
          ease: "Cubic.easeOut",
        });
      }
      this.dragStart = null;
    });
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        if (!this.overlayOpen()) {
          this.page.y = clampY(this.page.y - dy);
        }
      }
    );
  }

  private overlayOpen(): boolean {
    return this.children.list.some((child) => child instanceof Modal || child instanceof TutorialOverlay);
  }
}
