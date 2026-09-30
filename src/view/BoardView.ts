import * as Phaser from "phaser";
import type { Board } from "../core/board";
import { Fan, type Layout, mirrorLayout, PileKind, type PileSpec } from "../core/layout";
import type { Rules } from "../core/Rules";
import { buildCardAtlas, releaseCardAtlas } from "./cardAtlas";
import { tableFrameInset } from "./tablePainter";
import { CARD_ASPECT, CardView, EFFECT_PADDING_RATIO, GLOW_TEXTURE } from "./CardView";
import { textStyle } from "./ui";

export interface Area {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RenderOptions {
  readonly animate?: boolean;
  /** Milliseconds between successive cards starting to move. */
  readonly stagger?: number;
  /** Multiplier on the default move duration (autoplay runs faster). */
  readonly speed?: number;
  /** Start moving cards row by row across the piles, like a dealer. */
  readonly dealOrder?: boolean;
}

interface Geometry {
  readonly cardW: number;
  readonly cardH: number;
  readonly originX: number;
  readonly originY: number;
  readonly bottom: number;
}

/** Vertical spacing of fanned cards, in card heights. */
const FACE_DOWN_STEP = 0.12;
const FACE_UP_STEP = 0.31;
/** Horizontal spacing of fanned waste cards, in card widths. */
const SIDE_STEP = 0.27;
/** Card heights kept free below the top rows for fanned columns. */
const FAN_RESERVE = 2.7;

const DEPTH_BASE = 10;
const DEPTH_PER_LAYER = 150;
export const DEPTH_MOVING = 8000;
export const DEPTH_DRAGGING = 10000;

/**
 * Renders a Board. It is declarative: `render(board)` works out where every
 * card belongs and animates only those that changed, so moves, undo, deals
 * and autoplay all share one code path and can never disagree with the rules.
 */
export class BoardView {
  public readonly cards: CardView[];
  private readonly layouts: readonly Layout[];
  private layout: Layout;
  /** The atlas the cards currently draw from. */
  private atlasKey?: string;
  /** Grey out face-up cards that can't be played (a setting). */
  private dimLocked = true;
  private readonly placeholders: Phaser.GameObjects.Container[] = [];
  private readonly stockBadges = new Map<number, Phaser.GameObjects.Text>();
  private readonly targetGlows: Phaser.GameObjects.Image[] = [];
  private geometry!: Geometry;
  private board: Board;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly rules: Rules,
    board: Board,
    area: Area,
    leftHanded: boolean,
    private readonly accent: number
  ) {
    const base = leftHanded ? mirrorLayout(rules.layout) : rules.layout;
    this.layouts = base.portrait ? [base, base.portrait] : [base];
    this.layout = base;
    this.board = board;
    this.cards = rules.cards.map((card) => new CardView(scene, card));
    this.resize(area);
  }

  public get cardWidth(): number {
    return this.geometry.cardW;
  }

  public get cardHeight(): number {
    return this.geometry.cardH;
  }

  public get current(): Board {
    return this.board;
  }

  /** Recomputes card size and positions for a new screen area. */
  public resize(area: Area): void {
    // Cards fill the table right up to the frame, with a hairline of air.
    const { width, height } = this.scene.scale;
    const margin = tableFrameInset(width, height, "edge") + area.width * 0.0035;
    // Use the arrangement that gives the biggest cards on this screen.
    const fitted = this.layouts
      .map((layout) => ({ layout, cardW: this.fitCardWidth(layout, area, margin) }))
      .reduce((best, next) => (next.cardW > best.cardW ? next : best));
    this.layout = fitted.layout;
    const hasFans = this.layout.piles.some((pile) => pile.fan === Fan.Down);
    const cardW = fitted.cardW;
    const cardH = cardW * CARD_ASPECT;
    const usedHeight = this.layout.height * cardH;
    this.geometry = {
      cardW,
      cardH,
      originX: area.x + (area.width - this.layout.width * cardW) / 2,
      originY: hasFans ? area.y + margin * 0.6 : area.y + (area.height - usedHeight) / 2,
      bottom: area.y + area.height - margin * 0.5,
    };
    const atlas = buildCardAtlas(this.scene, cardW, cardH);
    this.cards.forEach((card) => card.useAtlas(atlas, cardW, cardH));
    if (this.atlasKey && this.atlasKey !== atlas.key) {
      releaseCardAtlas(this.scene, this.atlasKey);
    }
    this.atlasKey = atlas.key;
    this.drawPlaceholders();
    void this.render(this.board, { animate: false });
  }

  /** Turns greying out of unplayable cards on or off. */
  public setDimLocked(enabled: boolean): void {
    this.dimLocked = enabled;
    this.board.piles.forEach((pile, pileIndex) =>
      pile.forEach((id, index) => this.cards[id].setDimmed(this.lockedAt(this.board, pileIndex, index), true))
    );
  }

  /** Moves every card to where `board` says it belongs. Resolves when done. */
  public render(board: Board, options: RenderOptions = {}): Promise<void> {
    this.board = board;
    const animate = options.animate ?? true;
    const stagger = options.stagger ?? 0;
    const speed = options.speed ?? 1;
    const journeys: {
      card: CardView;
      target: Phaser.Math.Vector2;
      depth: number;
      faceUp: boolean;
      locked: boolean;
      distance: number;
    }[] = [];

    board.piles.forEach((pile, pileIndex) => {
      const spec = this.layout.piles[pileIndex];
      const positions = this.positionsFor(board, pileIndex);
      pile.forEach((id, index) => {
        const card = this.cards[id];
        const target = positions[index];
        const depth = this.depthFor(spec, index);
        const faceUp = spec.kind !== PileKind.Stock && index >= board.hidden[pileIndex];
        const locked = this.lockedAt(board, pileIndex, index);
        card.pile = pileIndex;
        card.index = index;
        const distance = Phaser.Math.Distance.Between(card.x, card.y, target.x, target.y);
        if (!animate || distance < 0.5) {
          if (!animate) {
            card.settle();
          } else if (this.scene.tweens.isTweening(card)) {
            // Already in place, but an earlier render may still have a
            // (possibly delayed) trip queued for it; cancel it, or it would
            // later carry the card away from where the board says it is.
            card.settle(true);
          }
          card.setPosition(target.x, target.y).setDepth(depth);
          card.setFaceUp(faceUp, animate);
          card.setDimmed(locked, animate);
          if (animate) {
            card.restPose();
          }
          return;
        }
        journeys.push({ card, target, depth, faceUp, locked, distance });
      });
    });

    if (options.dealOrder) {
      // Row by row across the piles: every pile's first card, then every second card…
      journeys.sort((a, b) => a.card.index - b.card.index || a.card.pile - b.card.pile);
    }
    // Only real trips take a turn in the stagger; tiny nudges start at once.
    let order = 0;
    const tweens = journeys.map(({ card, target, depth, faceUp, locked, distance }) => {
      const long = distance > this.geometry.cardW * 0.3;
      const delay = long ? order * stagger : 0;
      order += long ? 1 : 0;
      const moving = this.tweenCard(card, target, depth, delay, speed, distance);
      card.setFaceUp(faceUp, animate, delay + 60 * speed);
      card.setDimmed(locked, animate);
      return moving;
    });
    this.updatePlaceholders(board);
    return Promise.all(tweens).then(() => undefined);
  }

  /** Screen centre of the card at `index` in `pile` for the current board. */
  public cardCenter(pile: number, index: number): Phaser.Math.Vector2 {
    return this.positionsFor(this.board, pile)[index] ?? this.pileBase(pile);
  }

  /** Where the next card placed on `pile` would sit. */
  public dropAnchor(pile: number): Phaser.Math.Vector2 {
    const count = this.board.piles[pile].length;
    if (count === 0) {
      return this.pileBase(pile);
    }
    const spec = this.layout.piles[pile];
    const top = this.cardCenter(pile, count - 1);
    if (spec.fan === Fan.Down) {
      return new Phaser.Math.Vector2(top.x, top.y + this.geometry.cardH * FACE_UP_STEP);
    }
    return top;
  }

  /** Area where a dragged card counts as dropped onto `pile`. */
  public dropZone(pile: number): Phaser.Geom.Rectangle {
    const { cardW, cardH } = this.geometry;
    const base = this.pileBase(pile);
    const count = this.board.piles[pile].length;
    const last = count > 0 ? this.cardCenter(pile, count - 1) : base;
    const left = Math.min(base.x, last.x) - cardW / 2;
    const top = Math.min(base.y, last.y) - cardH / 2;
    return new Phaser.Geom.Rectangle(left, top, Math.abs(last.x - base.x) + cardW, Math.abs(last.y - base.y) + cardH);
  }

  /** Pile under a screen point (used for taps on empty piles such as the stock). */
  public pileAt(x: number, y: number): number | undefined {
    for (let pile = this.layout.piles.length - 1; pile >= 0; pile -= 1) {
      if (this.dropZone(pile).contains(x, y)) {
        return pile;
      }
    }
    return undefined;
  }

  /** Stacks every card face-down at a point: the start of the deal animation. */
  public gatherAt(point: Phaser.Math.Vector2): void {
    this.cards.forEach((card, i) => {
      card.setFaceUp(false, false);
      card.settle();
      card.setPosition(point.x, point.y).setDepth(DEPTH_BASE + i);
    });
  }

  /** Where the deal animation starts: the stock, or the middle of the table. */
  public dealOrigin(): Phaser.Math.Vector2 {
    const stock = this.layout.piles.findIndex((spec) => spec.kind === PileKind.Stock);
    const { originX, originY, cardW, bottom } = this.geometry;
    return stock >= 0
      ? this.pileBase(stock)
      : new Phaser.Math.Vector2(originX + (this.layout.width * cardW) / 2, originY + (bottom - originY) * 0.45);
  }

  /** Top-most visible card under a screen point. */
  public cardAt(x: number, y: number): CardView | undefined {
    let best: CardView | undefined;
    for (const card of this.cards) {
      if (card.visible && (!best || card.depth > best.depth) && card.containsPoint(x, y)) {
        best = card;
      }
    }
    return best;
  }

  public cardsFrom(pile: number, index: number): CardView[] {
    return this.board.piles[pile].slice(index).map((id) => this.cards[id]);
  }

  /** Glowing outlines on piles, e.g. legal drop targets while dragging. */
  public showTargets(piles: readonly number[], color = this.accent): void {
    this.clearTargets();
    for (const pile of piles) {
      const anchor =
        this.board.piles[pile].length === 0
          ? this.pileBase(pile)
          : this.cardCenter(pile, this.board.piles[pile].length - 1);
      const glow = this.scene.add
        .image(anchor.x, anchor.y, GLOW_TEXTURE)
        .setDisplaySize(this.geometry.cardW * EFFECT_PADDING_RATIO, this.geometry.cardH * EFFECT_PADDING_RATIO * 0.98)
        .setTint(color)
        .setDepth(DEPTH_DRAGGING - 1)
        .setAlpha(0.2)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: glow,
        alpha: 0.85,
        duration: 380,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.targetGlows.push(glow);
    }
  }

  public clearTargets(): void {
    this.targetGlows.splice(0).forEach((glow) => glow.destroy());
  }

  /** Every pile's on-screen bounds, for the tutorial spotlight. */
  public pileBoundsOfKind(kinds: readonly PileKind[]): Phaser.Geom.Rectangle[] {
    return this.layout.piles.flatMap((spec, pile) => (kinds.includes(spec.kind) ? [this.dropZone(pile)] : []));
  }

  public destroy(): void {
    this.clearTargets();
    this.cards.forEach((card) => card.destroy());
    this.placeholders.forEach((holder) => holder.destroy());
    this.stockBadges.forEach((badge) => badge.destroy());
  }

  // ---------------------------------------------------------------------------

  private fitCardWidth(layout: Layout, area: Area, margin: number): number {
    const hasFans = layout.piles.some((pile) => pile.fan === Fan.Down);
    const rows = layout.height + (hasFans ? FAN_RESERVE : 0);
    return Math.min((area.width - margin * 2) / layout.width, (area.height - margin) / (rows * CARD_ASPECT));
  }

  private tweenCard(
    card: CardView,
    target: Phaser.Math.Vector2,
    depth: number,
    delay: number,
    speed: number,
    distance: number
  ): Promise<void> {
    // Longer trips take a little longer, but never feel sluggish.
    const duration = Phaser.Math.Clamp(150 + distance / (this.geometry.cardW * 0.1), 170, 340) * speed;
    const moving = card.moveTo(target.x, target.y, { duration, delay, depth });
    card.setDepth(DEPTH_MOVING + depth);
    return moving;
  }

  /**
   * Whether a card is greyed out: face-up, in play (tableau, pyramid slots,
   * or under the waste's top card) and unable to move right now.
   */
  private lockedAt(board: Board, pile: number, index: number): boolean {
    if (!this.dimLocked || index < board.hidden[pile]) {
      return false;
    }
    const kind = this.layout.piles[pile].kind;
    const inPlay =
      kind === PileKind.Tableau ||
      kind === PileKind.Slot ||
      (kind === PileKind.Waste && index < board.piles[pile].length - 1);
    return inPlay && this.rules.isLocked(board, pile, index);
  }

  private pileBase(pile: number): Phaser.Math.Vector2 {
    const spec = this.layout.piles[pile];
    const { cardW, cardH, originX, originY } = this.geometry;
    return new Phaser.Math.Vector2(originX + spec.x * cardW + cardW / 2, originY + spec.y * cardH + cardH / 2);
  }

  private depthFor(spec: PileSpec, index: number): number {
    return DEPTH_BASE + (spec.z ?? 0) * DEPTH_PER_LAYER + index;
  }

  /** Centre of every card in a pile, including fan offsets that fit the screen. */
  private positionsFor(board: Board, pile: number): Phaser.Math.Vector2[] {
    const spec = this.layout.piles[pile];
    const base = this.pileBase(pile);
    const count = board.piles[pile].length;
    const { cardW, cardH, bottom } = this.geometry;
    const positions: Phaser.Math.Vector2[] = [];

    if (spec.fan === Fan.Down) {
      const hidden = Math.min(board.hidden[pile], count);
      let down = cardH * FACE_DOWN_STEP;
      let up = cardH * FACE_UP_STEP;
      const needed = hidden * down + Math.max(0, count - hidden - 1) * up;
      const available = bottom - (base.y + cardH / 2);
      if (needed > available && needed > 0) {
        const squeeze = Math.max(available, 0) / needed;
        down *= squeeze;
        up *= squeeze;
      }
      let y = base.y;
      for (let i = 0; i < count; i += 1) {
        positions.push(new Phaser.Math.Vector2(base.x, y));
        y += i < hidden ? down : up;
      }
      return positions;
    }

    if (spec.fan === Fan.Right || spec.fan === Fan.Left) {
      const direction = spec.fan === Fan.Right ? 1 : -1;
      const firstFanned = Math.max(0, count - (spec.fanLimit ?? count));
      for (let i = 0; i < count; i += 1) {
        positions.push(
          new Phaser.Math.Vector2(base.x + Math.max(0, i - firstFanned) * cardW * SIDE_STEP * direction, base.y)
        );
      }
      return positions;
    }

    if (spec.kind === PileKind.Stock) {
      // A slight offset every few cards gives the stock visible thickness.
      for (let i = 0; i < count; i += 1) {
        const layer = Math.floor(i / 6);
        positions.push(new Phaser.Math.Vector2(base.x - layer * cardW * 0.012, base.y - layer * cardH * 0.009));
      }
      return positions;
    }

    for (let i = 0; i < count; i += 1) {
      positions.push(base.clone());
    }
    return positions;
  }

  private drawPlaceholders(): void {
    this.placeholders.splice(0).forEach((holder) => holder.destroy());
    this.stockBadges.forEach((badge) => badge.destroy());
    this.stockBadges.clear();
    const { cardW, cardH } = this.geometry;
    this.layout.piles.forEach((spec, pile) => {
      const base = this.pileBase(pile);
      const holder = this.scene.add.container(base.x, base.y).setDepth(1);
      if (!spec.hideWhenEmpty) {
        const outline = this.scene.add.graphics();
        const radius = cardW * 0.07;
        const inset = cardW * 0.06;
        outline.fillStyle(0x000000, 0.2).fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, radius);
        outline
          .lineStyle(Math.max(1.5, cardW * 0.022), 0xffffff, 0.26)
          .strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, radius);
        // A faint inner line, like the stitched outline printed on a playmat.
        outline
          .lineStyle(Math.max(1, cardW * 0.012), this.accent, 0.22)
          .strokeRoundedRect(
            -cardW / 2 + inset,
            -cardH / 2 + inset,
            cardW - inset * 2,
            cardH - inset * 2,
            radius * 0.6
          );
        holder.add(outline);
        const label = this.scene.add
          .text(
            0,
            0,
            spec.placeholder ?? "",
            textStyle(cardW * (spec.placeholder && spec.placeholder.length > 1 ? 0.3 : 0.42), 0xffffff, true)
          )
          .setOrigin(0.5)
          .setAlpha(0.4);
        holder.add(label);
        holder.setData("label", label);
      }
      this.placeholders.push(holder);
      if (spec.kind === PileKind.Stock) {
        const badge = this.scene.add
          .text(base.x + cardW * 0.42, base.y + cardH * 0.46, "", {
            ...textStyle(cardW * 0.2, 0xffffff, true),
            backgroundColor: "rgba(0,0,0,0.55)",
            padding: { x: cardW * 0.06, y: cardW * 0.02 },
          })
          .setOrigin(1, 1)
          .setDepth(DEPTH_MOVING - 1);
        this.stockBadges.set(pile, badge);
      }
    });
  }

  /** Stock placeholder shows ↻ when tapping it would recycle the waste. */
  private updatePlaceholders(board: Board): void {
    this.layout.piles.forEach((spec, pile) => {
      if (spec.kind !== PileKind.Stock) {
        return;
      }
      const label = this.placeholders[pile]?.getData("label") as Phaser.GameObjects.Text | undefined;
      label?.setText(board.piles[pile].length === 0 && this.rules.canDraw(board) ? "↻" : "");
      const count = board.piles[pile].length;
      this.stockBadges
        .get(pile)
        ?.setText(count > 0 ? String(count) : "")
        .setVisible(count > 0);
    });
  }
}
