import * as Phaser from "phaser";
import type { Card } from "../core/cards";

/** The original card art: 14 columns × 4 rows, back design in frame 27. */
export const CARD_TEXTURE = "cards";
export const CARD_SHEET = { file: "assets/img/cards2.png", columns: 14, rows: 4 } as const;
export const BACK_FRAME = 27;
/** Card height / width of the artwork (360 / 250.71). */
export const CARD_ASPECT = 360 / (3510 / 14);

export const SHADOW_TEXTURE = "card_shadow";
export const GLOW_TEXTURE = "card_glow";

/**
 * Slices the sheet into frames at exact (fractional) positions. The sheet is
 * 3510 px wide, so each column is 250.71 px; letting Phaser round the frame
 * width would drift one pixel every few columns.
 */
export function registerCardFrames(scene: Phaser.Scene): void {
  const texture = scene.textures.get(CARD_TEXTURE);
  const source = texture.getSourceImage();
  const width = source.width / CARD_SHEET.columns;
  const height = source.height / CARD_SHEET.rows;
  for (let row = 0; row < CARD_SHEET.rows; row += 1) {
    for (let column = 0; column < CARD_SHEET.columns; column += 1) {
      texture.add(row * CARD_SHEET.columns + column, 0, column * width, row * height, width, height);
    }
  }
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Soft drop shadow and glow ring, generated once instead of shipped as images. */
export function createCardEffectTextures(scene: Phaser.Scene): void {
  const w = 250;
  const h = Math.round(w * CARD_ASPECT);
  const pad = 40;
  const draw = (key: string, paint: (ctx: CanvasRenderingContext2D) => void): void => {
    if (scene.textures.exists(key)) {
      return;
    }
    const texture = scene.textures.createCanvas(key, w + pad * 2, h + pad * 2);
    if (texture) {
      paint(texture.getContext());
      texture.refresh();
    }
  };
  // Drawn by hand: CanvasRenderingContext2D.roundRect is missing on older WebViews.
  const roundRect = (ctx: CanvasRenderingContext2D): void => {
    const r = 14;
    ctx.beginPath();
    ctx.moveTo(pad + r, pad);
    ctx.arcTo(pad + w, pad, pad + w, pad + h, r);
    ctx.arcTo(pad + w, pad + h, pad, pad + h, r);
    ctx.arcTo(pad, pad + h, pad, pad, r);
    ctx.arcTo(pad, pad, pad + w, pad, r);
    ctx.closePath();
  };
  draw(SHADOW_TEXTURE, (ctx) => {
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx);
    ctx.fill();
  });
  draw(GLOW_TEXTURE, (ctx) => {
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 24;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 10;
    roundRect(ctx);
    ctx.stroke();
    ctx.stroke();
  });
}

/** Size of the effect textures relative to a card (they include padding). */
export const EFFECT_PADDING_RATIO = (250 + 80) / 250;

export const frameOf = (card: Card): number => card.suit * CARD_SHEET.columns + card.rank - 1;

/**
 * One on-screen card. It only knows how to look (face, size, flip, lift);
 * where it sits is decided by BoardView from the game state.
 */
export class CardView extends Phaser.GameObjects.Sprite {
  public faceUp = false;
  /** Pile and index the card currently occupies (kept in sync by BoardView). */
  public pile = -1;
  public index = -1;
  private baseScaleX = 1;
  private baseScaleY = 1;
  private flipping = false;

  public constructor(
    scene: Phaser.Scene,
    public readonly card: Card
  ) {
    super(scene, 0, 0, CARD_TEXTURE, BACK_FRAME);
    scene.add.existing(this);
  }

  public setCardSize(width: number, height: number): this {
    this.setDisplaySize(width, height);
    this.baseScaleX = this.scaleX;
    this.baseScaleY = this.scaleY;
    return this;
  }

  /**
   * Stops any running animation and snaps the card to a consistent state
   * (correct face, normal size). Called before a card gets a new animation so
   * an interrupted flip can never leave it squashed or showing the wrong face.
   */
  public settle(): void {
    this.scene.tweens.killTweensOf(this);
    this.flipping = false;
    this.setFrame(this.faceUp ? frameOf(this.card) : BACK_FRAME);
    this.setScale(this.baseScaleX, this.baseScaleY);
  }

  public setFaceUp(faceUp: boolean, animate: boolean, delay = 0): void {
    if (faceUp === this.faceUp) {
      return;
    }
    this.faceUp = faceUp;
    const frame = faceUp ? frameOf(this.card) : BACK_FRAME;
    if (!animate) {
      this.setFrame(frame);
      return;
    }
    // Squash to an edge, swap the face, and expand: reads as a 3D turn.
    this.flipping = true;
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: this.baseScaleY * 1.06,
      duration: 90,
      delay,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.setFrame(frame);
        this.scene.tweens.add({
          targets: this,
          scaleX: this.baseScaleX,
          scaleY: this.baseScaleY,
          duration: 110,
          ease: "Quad.easeOut",
          onComplete: () => {
            this.flipping = false;
          },
        });
      },
    });
  }

  /** Grows the card slightly, as if picked up from the table. */
  public lift(on: boolean): void {
    if (this.flipping) {
      return;
    }
    const factor = on ? 1.06 : 1;
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScaleX * factor,
      scaleY: this.baseScaleY * factor,
      duration: on ? 90 : 140,
      ease: "Quad.easeOut",
    });
  }

  /** Brief pop used when a card lands somewhere meaningful. */
  public bump(delay = 0): void {
    if (this.flipping) {
      return;
    }
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScaleX * 1.08,
      scaleY: this.baseScaleY * 1.08,
      duration: 90,
      delay,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /** Side-to-side wiggle meaning "that move isn't allowed". */
  public shake(): void {
    const x = this.x;
    this.scene.tweens.add({
      targets: this,
      x: { from: x - this.displayWidth * 0.06, to: x },
      duration: 260,
      ease: "Elastic.easeOut",
      easeParams: [1.2, 0.3],
    });
  }
}
