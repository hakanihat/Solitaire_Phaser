import * as Phaser from "phaser";
import type { Card } from "../core/cards";
import type { CardAtlas } from "./cardAtlas";

/** The original card art: 14 columns × 4 rows, back design in frame 27. */
export const CARD_TEXTURE = "cards";
export const CARD_SHEET = { file: "assets/img/cards2.png", columns: 14, rows: 4 } as const;
export const BACK_FRAME = 27;
/** Card height / width of the artwork (360 / 250.71). */
export const CARD_ASPECT = 360 / (3510 / 14);

export const GLOW_TEXTURE = "card_glow";

/** How much bigger a lifted card gets (1 = +100%). */
const LIFT_SCALE = 0.07;
/** How much a card bulges vertically at the midpoint of a flip. */
const FLIP_BULGE = 0.06;
const FLIP_DURATION = 230;

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

/** A soft glow ring used for hints and drop targets, generated once. */
export function createCardEffectTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(GLOW_TEXTURE)) {
    return;
  }
  const w = 250;
  const h = Math.round(w * CARD_ASPECT);
  const pad = 40;
  const texture = scene.textures.createCanvas(GLOW_TEXTURE, w + pad * 2, h + pad * 2);
  if (!texture) {
    return;
  }
  const ctx = texture.getContext();
  const r = 14;
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 24;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  // Drawn by hand: CanvasRenderingContext2D.roundRect is missing on older WebViews.
  ctx.beginPath();
  ctx.moveTo(pad + r, pad);
  ctx.arcTo(pad + w, pad, pad + w, pad + h, r);
  ctx.arcTo(pad + w, pad + h, pad, pad + h, r);
  ctx.arcTo(pad, pad + h, pad, pad, r);
  ctx.arcTo(pad, pad, pad + w, pad, r);
  ctx.closePath();
  ctx.stroke();
  ctx.stroke();
  texture.refresh();
}

/** Size of the glow texture relative to a card (it includes padding). */
export const EFFECT_PADDING_RATIO = (250 + 80) / 250;

export const frameOf = (card: Card): number => card.suit * CARD_SHEET.columns + card.rank - 1;

/**
 * One on-screen card. It only knows how to look and move (face, size, flip,
 * lift, tilt); where it sits is decided by BoardView from the game state.
 *
 * Lift, flip progress and tilt are independent values combined into a single
 * scale and angle, so overlapping animations (a card flipping while it flies,
 * a drag released mid-flip) never fight over the same property.
 */
export class CardView extends Phaser.GameObjects.Sprite {
  public faceUp = false;
  /** Pile and index the card currently occupies (kept in sync by BoardView). */
  public pile = -1;
  public index = -1;
  private cardW = 1;
  private cardH = 1;
  private baseScale = 1;
  private liftValue = 0;
  /** 0 → 1 over a flip; 1 when at rest. The face swaps at 0.5. */
  private flipValue = 1;
  private pendingFrame: number | null = null;
  /** Resolves the promise of an in-flight move; see `moveTo` and `settle`. */
  private arrival: (() => void) | null = null;

  public constructor(
    scene: Phaser.Scene,
    public readonly card: Card
  ) {
    super(scene, 0, 0, CARD_TEXTURE, BACK_FRAME);
    scene.add.existing(this);
  }

  // Tweened properties -------------------------------------------------------

  public get liftAmount(): number {
    return this.liftValue;
  }

  public set liftAmount(value: number) {
    this.liftValue = value;
    this.applyScale();
  }

  public get flipProgress(): number {
    return this.flipValue;
  }

  public set flipProgress(value: number) {
    this.flipValue = value;
    if (value >= 0.5 && this.pendingFrame !== null) {
      this.setFrame(this.pendingFrame);
      this.pendingFrame = null;
    }
    this.applyScale();
  }

  // Appearance -----------------------------------------------------------------

  /** Switches to a pre-rendered atlas sized for `width` × `height` cards. */
  public useAtlas(atlas: CardAtlas, width: number, height: number): this {
    this.cardW = width;
    this.cardH = height;
    this.setTexture(atlas.key, this.frameForFace());
    this.baseScale = width / atlas.width;
    this.applyScale();
    return this;
  }

  /** Hit test against the card itself, ignoring its shadow margin. */
  public containsPoint(x: number, y: number): boolean {
    return Math.abs(x - this.x) <= this.cardW / 2 && Math.abs(y - this.y) <= this.cardH / 2;
  }

  public get cardWidth(): number {
    return this.cardW;
  }

  public get cardHeight(): number {
    return this.cardH;
  }

  /**
   * Stops every animation and snaps to a consistent state (correct face,
   * resting size). With `keepPose`, lift and tilt are kept so the next
   * animation can ease them out instead of popping.
   */
  public settle(keepPose = false): void {
    // Phaser destroys killed tweens without firing onStop/onComplete, so any
    // caller awaiting this card's arrival must be released explicitly.
    this.resolveArrival();
    this.scene.tweens.killTweensOf(this);
    this.pendingFrame = null;
    this.flipValue = 1;
    this.setFrame(this.frameForFace());
    if (!keepPose) {
      this.liftValue = 0;
      this.setAngle(0);
    }
    this.applyScale();
  }

  /**
   * Glides to a point, rising a little and tilting in the direction of travel
   * like a card slid across a table. The promise always settles: on arrival,
   * or as soon as the motion is interrupted.
   */
  public moveTo(x: number, y: number, options: { duration: number; delay: number; depth: number }): Promise<void> {
    this.settle(true);
    const dx = x - this.x;
    const long = Math.hypot(dx, y - this.y) > this.cardW * 0.6;
    return new Promise((resolve) => {
      this.arrival = resolve;
      this.scene.tweens.add({
        targets: this,
        x,
        y,
        delay: options.delay,
        duration: options.duration,
        ease: "Cubic.easeOut",
        onComplete: () => {
          this.setDepth(options.depth);
          this.resolveArrival();
        },
      });
      if (this.liftValue > 0 || this.angle !== 0) {
        // Coming out of a drag: ease the pose back down during the flight.
        this.scene.tweens.add({
          targets: this,
          liftAmount: 0,
          angle: 0,
          delay: options.delay,
          duration: options.duration,
          ease: "Quad.easeOut",
        });
      } else if (long) {
        const tilt = Phaser.Math.Clamp(dx / this.cardW, -1, 1) * 5;
        this.scene.tweens.add({
          targets: this,
          liftAmount: 1,
          angle: tilt,
          delay: options.delay,
          duration: options.duration / 2,
          yoyo: true,
          ease: "Sine.easeOut",
        });
      }
    });
  }

  public setFaceUp(faceUp: boolean, animate: boolean, delay = 0): void {
    if (faceUp === this.faceUp) {
      return;
    }
    this.faceUp = faceUp;
    if (!animate) {
      this.pendingFrame = null;
      this.flipValue = 1;
      this.setFrame(this.frameForFace());
      this.applyScale();
      return;
    }
    // Squash to an edge, swap the face, and expand: reads as a 3D turn.
    this.pendingFrame = this.frameForFace();
    this.flipValue = 0;
    this.scene.tweens.add({ targets: this, flipProgress: 1, delay, duration: FLIP_DURATION, ease: "Sine.easeInOut" });
  }

  /** Raises or lowers the card, as when picked up for a drag. */
  public setLifted(lifted: boolean): void {
    this.scene.tweens.add({
      targets: this,
      liftAmount: lifted ? 1 : 0,
      duration: lifted ? 90 : 150,
      ease: "Quad.easeOut",
    });
  }

  /** Eases lift and tilt back to rest (e.g. a drag dropped where it started). */
  public restPose(): void {
    if (this.liftValue > 0 || this.angle !== 0) {
      this.scene.tweens.add({ targets: this, liftAmount: 0, angle: 0, duration: 150, ease: "Quad.easeOut" });
    }
  }

  /** Leans the card towards where it is being dragged (called every move). */
  public leanTowards(velocityX: number): void {
    const target = Phaser.Math.Clamp(velocityX * 0.35, -9, 9);
    this.setAngle(this.angle + (target - this.angle) * 0.35);
  }

  /** Brief pop used when a card lands somewhere meaningful. */
  public bump(delay = 0): void {
    this.scene.tweens.add({ targets: this, liftAmount: 0.8, duration: 90, delay, yoyo: true, ease: "Quad.easeOut" });
  }

  /** Side-to-side wiggle meaning "that move isn't allowed". */
  public shake(): void {
    const x = this.x;
    this.scene.tweens.add({
      targets: this,
      x: { from: x - this.cardW * 0.07, to: x },
      duration: 280,
      ease: "Elastic.easeOut",
      easeParams: [1.2, 0.3],
    });
  }

  // ---------------------------------------------------------------------------

  private frameForFace(): number {
    return this.faceUp ? frameOf(this.card) : BACK_FRAME;
  }

  private applyScale(): void {
    const lift = 1 + LIFT_SCALE * this.liftValue;
    const turn = Math.abs(2 * this.flipValue - 1);
    const bulge = 1 + FLIP_BULGE * Math.sin(Math.PI * this.flipValue);
    this.setScale(this.baseScale * lift * turn, this.baseScale * lift * bulge);
  }

  private resolveArrival(): void {
    const arrival = this.arrival;
    this.arrival = null;
    arrival?.();
  }
}
