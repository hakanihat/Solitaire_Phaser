import * as Phaser from "phaser";
import { SOUND_FILES } from "../services/audio";
import { CARD_FONT, CARD_FONT_FILE } from "../view/cardFaces";
import { CARD_SHEET, CARD_TEXTURE, createCardEffectTextures, registerCardFrames } from "../view/CardView";
import { createSuitTexture } from "../view/celebrations";
import { uiScale } from "../view/viewport";
import { FX, SceneKey } from "./keys";

/**
 * Loads the few shipped assets (card art and sounds) and generates every
 * other texture procedurally, then hands over to the menu.
 */
export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.Boot);
  }

  public preload(): void {
    const { width, height } = this.scale;
    const ui = uiScale(this);
    this.cameras.main.setBackgroundColor("#0b3d24");
    const barWidth = Math.min(width * 0.6, 320 * ui);
    const barHeight = 8 * ui;
    const track = this.add.graphics();
    track
      .fillStyle(0xffffff, 0.15)
      .fillRoundedRect((width - barWidth) / 2, height * 0.6, barWidth, barHeight, barHeight / 2);
    const bar = this.add.graphics();
    this.add
      .text(width / 2, height * 0.45, "♠ ♥ ♣ ♦", {
        fontFamily: "sans-serif",
        fontSize: `${38 * ui}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setAlpha(0.85);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      bar.clear();
      bar
        .fillStyle(0xffd166, 1)
        .fillRoundedRect((width - barWidth) / 2, height * 0.6, barWidth * value, barHeight, barHeight / 2);
    });

    this.load.image(CARD_TEXTURE, CARD_SHEET.file);
    // Card faces are painted with this font, so it must be ready before any atlas.
    this.load.font(CARD_FONT, CARD_FONT_FILE, "woff2", { weight: "100 900" });
    Object.values(SOUND_FILES).forEach(({ key, file }) => this.load.audio(key, file));
  }

  public create(): void {
    registerCardFrames(this);
    createCardEffectTextures(this);
    this.createParticleTextures();
    createSuitTexture(this);
    this.scene.start(SceneKey.Menu);
  }

  private createParticleTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // Soft round dot.
    for (let r = 16; r > 0; r -= 2) {
      g.fillStyle(0xffffff, 0.08 + (1 - r / 16) * 0.5).fillCircle(16, 16, r);
    }
    g.generateTexture(FX.dot, 32, 32);
    g.clear();
    // Four-pointed sparkle.
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(16, 0, 19, 16, 13, 16).fillTriangle(16, 32, 19, 16, 13, 16);
    g.fillTriangle(0, 16, 16, 13, 16, 19).fillTriangle(32, 16, 16, 13, 16, 19);
    g.generateTexture(FX.spark, 32, 32);
    g.clear();
    // Confetti strip.
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 10, 18);
    g.generateTexture(FX.confetti, 10, 18);
    g.destroy();
  }
}
