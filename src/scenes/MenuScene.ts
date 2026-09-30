import * as Phaser from "phaser";
import { createCards, Suit } from "../core/cards";
import { DIFFICULTIES, type Difficulty } from "../core/Rules";
import type { VariantDefinition, VariantTheme } from "../core/variant";
import { INPUT_RESET } from "../services/lifecycle";
import { storage } from "../services/storage";
import { VARIANTS } from "../variants";
import { cardImage } from "../view/cardAtlas";
import { frameOf } from "../view/CardView";
import { smoothMotion } from "../view/pixelSnap";
import { openSettings } from "../view/SettingsPanel";
import { addAmbient } from "../view/ambient";
import { ornateFrame } from "../view/frames";
import { coverTable, paintTable, tableFrameInset } from "../view/tablePainter";
import { TutorialOverlay } from "../view/TutorialOverlay";
import { Button, COLORS, Modal, shade, textStyle } from "../view/ui";
import { drawIcon } from "../view/icons";
import { uiScale } from "../view/viewport";
import { formatTime } from "./format";
import { type LoadingData, SceneKey } from "./keys";

const LOBBY_THEME: VariantTheme = {
  table: [0x1d4a6b, 0x0a1826],
  accent: 0xffd166,
  pattern: "felt",
  ambient: "motes",
  intro: "fan",
};
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
    const { width } = this.scale;
    const ui = uiScale(this);
    const font = 16 * ui;
    coverTable(this, LOBBY_THEME, "menu");
    addAmbient(this, LOBBY_THEME, font);

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
    // Part of the page, so it scrolls away rather than floating over the tiles.
    this.page.add(gear);

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
      const sprite = cardImage(this, width / 2 + (i - 1.5) * cardW * 0.42, font * 5.2, frameOf(card), cardW)
        .setOrigin(0.5, 0.9)
        .setAngle(angle);
      this.page.add(smoothMotion(sprite));
      this.tweens.add({
        targets: sprite,
        angle: angle * 1.25,
        // Same tempo for every card so the fan breathes as one.
        duration: 2200,
        delay: i * 90,
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

  /**
   * The "continue" card: a framed miniature of the saved game's table with
   * its name, a peek of its cards and a play button.
   */
  private buildResume(y: number, font: number): number {
    const saved = storage.savedGame();
    const variant = saved ? VARIANTS.find((candidate) => candidate.id === saved.variant) : undefined;
    if (!saved || !variant) {
      return y;
    }
    const { width } = this.scale;
    const w = Math.min(width - font * 2, font * 26);
    const h = font * 4.6;
    const radius = font * 1;
    const resume = (): void => this.launch({ variant: variant.id, difficulty: saved.difficulty, resume: true });
    const card = this.add.container(width / 2, y + h / 2 + font * 0.2);
    const shadowBox = this.add
      .graphics()
      .fillStyle(0x000000, 0.35)
      .fillRoundedRect(-w / 2 + 3, -h / 2 + 7, w, h, radius);
    const face = this.add.image(
      0,
      0,
      paintTable(this, variant.theme, `resume_${variant.id}`, w, h, { cornerRadius: radius })
    );
    const frame = this.add.image(
      0,
      0,
      ornateFrame(this, `resume_${variant.id}`, w, h, radius, variant.theme.accent, true)
    );
    card.add([shadowBox, face, frame]);

    // A peek at the game's signature cards on the left.
    const cardW = h * 0.44;
    (TILE_CARDS[variant.id] ?? []).slice(0, 2).forEach(([suit, rank], i) => {
      const found = DECK.find((c) => c.suit === suit && c.rank === rank);
      if (found) {
        card.add(
          cardImage(this, -w / 2 + font * 2.4 + i * cardW * 0.42, font * 0.2, frameOf(found), cardW).setAngle(
            (i - 0.5) * 14
          )
        );
      }
    });
    const textX = -w / 2 + font * 5.4;
    const kicker = this.add
      .text(textX, -font * 0.75, "CONTINUE", textStyle(font * 0.72, COLORS.gold, true))
      .setOrigin(0, 0.5)
      .setLetterSpacing(font * 0.2);
    const title = this.add
      .text(
        textX,
        font * 0.55,
        `${variant.name} · ${variant.difficulties[saved.difficulty].label}`,
        textStyle(font * 1.1, COLORS.text, true)
      )
      .setOrigin(0, 0.5);
    title.setShadow(0, 2, "#000000", 4, false, true);
    const play = new Button(this, w / 2 - h * 0.66, 0, {
      width: h * 0.68,
      height: h * 0.68,
      icon: "play",
      style: "primary",
      accent: COLORS.gold,
      fontSize: font,
      onClick: resume,
    });
    card.add([kicker, title, play]);
    // A gentle pulse invites the player back in.
    play.setPulse(true);

    card.setSize(w, h).setInteractive({ useHandCursor: true });
    card.on(Phaser.Input.Events.POINTER_DOWN, () => this.tweens.add({ targets: card, scale: 0.97, duration: 80 }));
    card.on(Phaser.Input.Events.POINTER_OUT, () => this.tweens.add({ targets: card, scale: 1, duration: 120 }));
    card.on(Phaser.Input.Events.POINTER_UP, () => {
      this.tweens.add({ targets: card, scale: 1, duration: 150, ease: "Back.easeOut" });
      if (!this.scrolled) {
        resume();
      }
    });
    this.page.add(card);
    return y + h + font * 1.4;
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
      const tile = this.buildTile(variant, x, y, tileW, tileH, font);
      this.page.add(tile);
      // Tiles rise into place one after another.
      tile.setAlpha(0).setY(y + font * 2);
      this.tweens.add({ targets: tile, alpha: 1, y, duration: 420, delay: 80 + i * 45, ease: "Back.easeOut" });
    });
    return top + Math.ceil(VARIANTS.length / columns) * (tileH + margin);
  }

  /** "ORIGINAL" pill sitting on a tile's top edge, for games designed for this collection. */
  private originalBadge(accent: number, y: number, font: number): Phaser.GameObjects.Container {
    const label = this.add
      .text(0, 0, "ORIGINAL", textStyle(font * 0.62, 0x1d1d2b, true))
      .setOrigin(0.5)
      .setLetterSpacing(font * 0.14);
    const w = label.width + font * 1.4;
    const h = font * 1.25;
    const pill = this.add.graphics();
    pill.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2, -h / 2 + font * 0.12, w, h, h / 2);
    pill.fillStyle(accent, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    pill.lineStyle(Math.max(1.5, font * 0.1), shade(accent, -0.45), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    pill
      .lineStyle(Math.max(1, font * 0.05), 0xffffff, 0.5)
      .strokeRoundedRect(
        -w / 2 + font * 0.14,
        -h / 2 + font * 0.1,
        w - font * 0.28,
        h - font * 0.2,
        (h - font * 0.2) / 2
      );
    return this.add.container(0, y, [pill, label]);
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
    // Each tile is the game's own table with an illustrated scene of the game.
    const shadow = this.add
      .graphics()
      .fillStyle(0x000000, 0.3)
      .fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, radius);
    const face = this.add.image(
      0,
      0,
      paintTable(this, variant.theme, `tile_${variant.id}`, w, h, { cornerRadius: radius, emblem: true })
    );
    const frame = this.add.image(0, 0, ornateFrame(this, `tile_${variant.id}`, w, h, radius, accent, variant.original));
    tile.add([shadow, face, frame]);

    // A little hand of the game's signature cards, fanned from a pivot.
    const cardW = h * 0.3;
    const pivotX = w / 2 - cardW * 0.95;
    const pivotY = h * 0.04;
    (TILE_CARDS[variant.id] ?? []).forEach(([suit, rank], i) => {
      const card = DECK.find((c) => c.suit === suit && c.rank === rank);
      if (card) {
        tile.add(
          cardImage(this, pivotX + (i - 1) * cardW * 0.32, pivotY, frameOf(card), cardW)
            .setOrigin(0.5, 0.85)
            .setAngle((i - 1) * 16)
        );
      }
    });

    // Text is stacked from the bottom edge, inside the frame's filigree, so
    // long taglines never overflow or cross the border.
    const textLeft = -w / 2 + font * 1.25;
    const tagline = this.add
      .text(textLeft, h / 2 - font * 1.15, variant.tagline, {
        ...textStyle(font * 0.72, COLORS.muted),
        wordWrap: { width: w - font * 2.5 },
      })
      .setOrigin(0, 1);
    const name = this.add
      .text(textLeft, tagline.y - tagline.height - font * 0.1, variant.name, textStyle(font * 1.2, COLORS.text, true))
      .setOrigin(0, 1);
    name.setShadow(0, 2, "#000000", 4, false, true);
    tagline.setShadow(0, 1, "#000000", 3, false, true);
    tile.add([name, tagline]);

    if (variant.original) {
      tile.add(this.originalBadge(accent, -h / 2, font));
    }
    const wins = storage.totalWins(variant.id);
    if (wins > 0) {
      const trophy = drawIcon(this, "trophy", font * 0.9, COLORS.gold).setPosition(
        -w / 2 + font * 1.7,
        -h / 2 + (variant.original ? font * 2.9 : font * 1.6)
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
    const { width, height } = this.scale;
    // Clip the scrolling page to the inside of the table frame, so tiles
    // slide under the border instead of spilling over it.
    const inset = tableFrameInset(width, height);
    const clip = this.make
      .graphics({}, false)
      .fillStyle(0xffffff)
      .fillRect(0, inset, width, height - inset * 2);
    this.page.setMask(clip.createGeometryMask());
    const minY = Math.min(0, height - inset * 1.5 - this.pageHeight);
    const clampY = (value: number): number => Phaser.Math.Clamp(value, minY, 0);
    // A scroll interrupted by an app switch must not resume on the next touch.
    const dropGesture = (): void => {
      this.dragStart = null;
    };
    this.game.events.on(INPUT_RESET, dropGesture);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(INPUT_RESET, dropGesture));
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
