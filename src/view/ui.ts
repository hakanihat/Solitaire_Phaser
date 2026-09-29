import * as Phaser from "phaser";
import { drawIcon, type IconName } from "./icons";

export const FONT_FAMILY = '"Nunito", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif';

export const COLORS = {
  text: 0xffffff,
  textDark: 0x1d1d2b,
  muted: 0xc9d2dc,
  panel: 0x16202c,
  panelEdge: 0x2f3d4f,
  shade: 0x000000,
  /** Points, rewards and the victory banner. */
  gold: 0xffd54f,
} as const;

export const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

export function textStyle(
  size: number,
  color: number = COLORS.text,
  bold = false
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${Math.round(size)}px`,
    color: hex(color),
    fontStyle: bold ? "bold" : "normal",
  };
}

/** Relative luminance check used to pick readable text on accent colours. */
export const isLight = (color: number): boolean =>
  0.299 * ((color >> 16) & 255) + 0.587 * ((color >> 8) & 255) + 0.114 * (color & 255) > 150;

export type ButtonStyle = "primary" | "ghost" | "toolbar";

export interface ButtonOptions {
  readonly width: number;
  readonly height: number;
  readonly label?: string;
  readonly icon?: IconName;
  readonly style?: ButtonStyle;
  readonly accent: number;
  readonly fontSize: number;
  readonly onClick: () => void;
}

/** Mixes a colour towards white (amount > 0) or black (amount < 0). */
export function shade(color: number, amount: number): number {
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (channel: number): number => Math.round(channel + (target - channel) * t);
  return (mix((color >> 16) & 255) << 16) | (mix((color >> 8) & 255) << 8) | mix(color & 255);
}

const rgbaOf = (color: number, alpha: number): string =>
  `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;

function pillPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = Math.min(h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Paints a button background (pill, or circle when square) into a cached
 * canvas texture at native resolution: real gradients, a glossy highlight
 * and a soft shadow — crisper and richer than vector shapes.
 */
function buttonSkin(
  scene: Phaser.Scene,
  style: "primary" | "ghost",
  width: number,
  height: number,
  accent: number
): string {
  const w = Math.round(width);
  const h = Math.round(height);
  const key = `btn_${style}_${accent.toString(16)}_${w}x${h}`;
  if (scene.textures.exists(key)) {
    return key;
  }
  const pad = Math.ceil(h * 0.3);
  const texture = scene.textures.createCanvas(key, w + pad * 2, h + pad * 2);
  if (!texture) {
    return key;
  }
  const ctx = texture.getContext();
  const x = pad;
  const y = pad;

  // Soft drop shadow.
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = h * 0.28;
  ctx.shadowOffsetY = h * 0.1;
  pillPath(ctx, x, y, w, h);
  ctx.fillStyle = style === "primary" ? hex(accent) : "rgba(12, 16, 22, 0.9)";
  ctx.fill();
  ctx.restore();

  // Body gradient.
  const body = ctx.createLinearGradient(0, y, 0, y + h);
  if (style === "primary") {
    body.addColorStop(0, hex(shade(accent, 0.35)));
    body.addColorStop(0.55, hex(accent));
    body.addColorStop(1, hex(shade(accent, -0.18)));
  } else {
    body.addColorStop(0, "rgba(46, 56, 72, 0.88)");
    body.addColorStop(1, "rgba(12, 16, 22, 0.88)");
  }
  pillPath(ctx, x, y, w, h);
  ctx.fillStyle = body;
  ctx.fill();

  // Glossy highlight across the upper half.
  ctx.save();
  pillPath(ctx, x, y, w, h);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  gloss.addColorStop(0, `rgba(255, 255, 255, ${style === "primary" ? 0.45 : 0.16})`);
  gloss.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, w, h * 0.55);
  ctx.restore();

  // Rim: light on top, darker at the bottom, for a pressed-metal edge.
  const rim = ctx.createLinearGradient(0, y, 0, y + h);
  if (style === "primary") {
    rim.addColorStop(0, "rgba(255, 255, 255, 0.7)");
    rim.addColorStop(1, rgbaOf(shade(accent, -0.45), 0.9));
  } else {
    rim.addColorStop(0, "rgba(255, 255, 255, 0.32)");
    rim.addColorStop(1, rgbaOf(accent, 0.28));
  }
  ctx.lineWidth = Math.max(1.5, h * 0.035);
  pillPath(ctx, x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.strokeStyle = rim;
  ctx.stroke();

  texture.refresh();
  return key;
}

/**
 * Glossy button with an optional icon. Gives immediate press feedback
 * (squash on press, spring back on release) and only fires when the pointer
 * is released over the button, so drags that start on a button are harmless.
 * Square buttons render as circles.
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly caption?: Phaser.GameObjects.Text;
  /** Toolbar style: the soft disc behind the icon that brightens on press. */
  private readonly bubble?: Phaser.GameObjects.Arc;
  private enabled = true;
  private pressed = false;
  private pulseTween?: Phaser.Tweens.Tween;

  public constructor(scene: Phaser.Scene, x: number, y: number, options: ButtonOptions) {
    super(scene, x, y);
    const { width, height, label, icon, accent, fontSize } = options;
    const style = options.style ?? "ghost";
    if (style !== "toolbar") {
      this.add(scene.add.image(0, 0, buttonSkin(scene, style, width, height, accent)));
    }

    const foreground = style === "primary" && isLight(accent) ? COLORS.textDark : COLORS.text;
    if (icon) {
      const iconSize = style === "toolbar" ? height * 0.36 : label ? height * 0.46 : height * 0.5;
      const iconY = style === "toolbar" && label ? -height * 0.16 : 0;
      const iconX = style !== "toolbar" && label ? -width / 2 + height * 0.62 : 0;
      if (style === "toolbar") {
        this.bubble = scene.add.circle(0, iconY, height * 0.3, accent, 0.14);
        this.add(this.bubble);
      }
      this.add(drawIcon(scene, icon, iconSize, style === "toolbar" ? accent : foreground).setPosition(iconX, iconY));
    }
    if (label) {
      const captionY = style === "toolbar" && icon ? height * 0.3 : 0;
      const captionX = style !== "toolbar" && icon ? height * 0.28 : 0;
      const size = style === "toolbar" ? fontSize * 0.86 : fontSize * 1.08;
      this.caption = scene.add
        .text(captionX, captionY, label, textStyle(size, style === "toolbar" ? COLORS.text : foreground, true))
        .setOrigin(0.5);
      if (style === "primary" && !isLight(accent)) {
        this.caption.setShadow(0, 1, "rgba(0,0,0,0.4)", 2);
      }
      this.add(this.caption);
    }

    this.setSize(width, height);
    this.setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.POINTER_DOWN, () => this.press(true));
    this.on(Phaser.Input.Events.POINTER_OUT, () => this.press(false));
    this.on(Phaser.Input.Events.POINTER_UP, () => {
      const wasPressed = this.pressed;
      this.press(false);
      if (this.enabled && wasPressed) {
        options.onClick();
      }
    });
    scene.add.existing(this);
  }

  public setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.38);
    return this;
  }

  public setLabel(text: string): this {
    this.caption?.setText(text);
    return this;
  }

  /** A gentle breathing animation that draws the eye (e.g. Auto finish). */
  public setPulse(on: boolean): this {
    this.pulseTween?.stop();
    this.pulseTween = undefined;
    this.setScale(1);
    if (on) {
      this.pulseTween = this.scene.tweens.add({
        targets: this,
        scale: 1.08,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    return this;
  }

  private press(down: boolean): void {
    this.pressed = down && this.enabled;
    if (!this.enabled || this.pulseTween) {
      return;
    }
    this.scene.tweens.add({
      targets: this,
      scale: down ? 0.93 : 1,
      duration: down ? 70 : 160,
      ease: down ? "Quad.easeOut" : "Back.easeOut",
    });
    if (this.bubble) {
      this.scene.tweens.add({
        targets: this.bubble,
        fillAlpha: down ? 0.34 : 0.14,
        scale: down ? 1.12 : 1,
        duration: 120,
      });
    }
  }
}

/**
 * Modal dialog: dims and blocks the scene behind it, pops a panel in, and
 * closes on the close button or by tapping outside (when dismissible).
 */
export class Modal extends Phaser.GameObjects.Container {
  public readonly panel: Phaser.GameObjects.Container;
  public readonly panelWidth: number;
  public readonly panelHeight: number;
  private closing = false;

  public constructor(
    scene: Phaser.Scene,
    options: {
      width: number;
      height: number;
      title: string;
      titleSize: number;
      accent: number;
      dismissible?: boolean;
      onClose?: () => void;
    }
  ) {
    super(scene, 0, 0);
    const { width: sw, height: sh } = scene.scale;
    const shade = scene.add.rectangle(0, 0, sw, sh, COLORS.shade, 0.55).setOrigin(0).setInteractive();
    if (options.dismissible !== false) {
      shade.on(Phaser.Input.Events.POINTER_UP, () => this.close(options.onClose));
    }
    this.add(shade);

    this.panelWidth = options.width;
    this.panelHeight = options.height;
    this.panel = scene.add.container(sw / 2, sh / 2);
    const bg = scene.add.graphics();
    const radius = Math.min(options.width, options.height) * 0.06;
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(
      -options.width / 2 + 4,
      -options.height / 2 + 8,
      options.width,
      options.height,
      radius
    );
    bg.fillStyle(COLORS.panel, 0.97).fillRoundedRect(
      -options.width / 2,
      -options.height / 2,
      options.width,
      options.height,
      radius
    );
    bg.lineStyle(2, options.accent, 0.6).strokeRoundedRect(
      -options.width / 2,
      -options.height / 2,
      options.width,
      options.height,
      radius
    );
    // Swallow taps on the panel so they don't reach the shade.
    const blocker = scene.add.zone(0, 0, options.width, options.height).setInteractive();
    const title = scene.add
      .text(
        0,
        -options.height / 2 + options.titleSize * 1.3,
        options.title,
        textStyle(options.titleSize, options.accent, true)
      )
      .setOrigin(0.5);
    this.panel.add([bg, blocker, title]);
    this.add(this.panel);

    // Above cards, effects and the victory show.
    this.setDepth(20000);
    scene.add.existing(this);
    this.panel.setScale(0.9).setAlpha(0);
    shade.setAlpha(0);
    scene.tweens.add({ targets: shade, alpha: 1, duration: 180 });
    scene.tweens.add({ targets: this.panel, scale: 1, alpha: 1, duration: 260, ease: "Back.easeOut" });
  }

  public close(then?: () => void): void {
    if (this.closing) {
      return;
    }
    this.closing = true;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        this.destroy();
        then?.();
      },
    });
  }
}

/** A short message bubble near the bottom of the screen. */
export class Toast {
  private current?: Phaser.GameObjects.Container;

  public constructor(private readonly scene: Phaser.Scene) {}

  public show(message: string, options: { y: number; fontSize: number; accent: number; duration?: number }): void {
    this.hide();
    const { width } = this.scene.scale;
    const text = this.scene.add
      .text(0, 0, message, { ...textStyle(options.fontSize), align: "center", wordWrap: { width: width * 0.8 } })
      .setOrigin(0.5);
    const padX = options.fontSize * 1.1;
    const padY = options.fontSize * 0.7;
    const bg = this.scene.add.graphics();
    const w = text.width + padX * 2;
    const h = text.height + padY * 2;
    bg.fillStyle(COLORS.panel, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2 > 40 ? 20 : h / 2);
    bg.lineStyle(2, options.accent, 0.7).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2 > 40 ? 20 : h / 2);
    const toast = this.scene.add
      .container(width / 2, options.y, [bg, text])
      .setDepth(900)
      .setAlpha(0);
    this.current = toast;
    this.scene.tweens.add({
      targets: toast,
      alpha: 1,
      y: options.y - options.fontSize * 0.6,
      duration: 220,
      ease: "Quad.easeOut",
    });
    this.scene.time.delayedCall(options.duration ?? 3200, () => {
      if (this.current === toast) {
        this.hide();
      }
    });
  }

  public hide(): void {
    const toast = this.current;
    this.current = undefined;
    if (toast) {
      this.scene.tweens.add({ targets: toast, alpha: 0, duration: 200, onComplete: () => toast.destroy() });
    }
  }
}

/** On/off switch with a label, used in the settings panel. */
export class Toggle extends Phaser.GameObjects.Container {
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly track: Phaser.GameObjects.Graphics;
  private value: boolean;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: {
      width: number;
      label: string;
      fontSize: number;
      accent: number;
      value: boolean;
      onChange: (value: boolean) => void;
    }
  ) {
    super(scene, x, y);
    const h = options.fontSize * 1.5;
    const trackW = h * 1.8;
    this.value = options.value;
    const label = scene.add.text(-options.width / 2, 0, options.label, textStyle(options.fontSize)).setOrigin(0, 0.5);
    this.track = scene.add.graphics();
    this.knob = scene.add.circle(0, 0, h * 0.4, 0xffffff);
    const trackX = options.width / 2 - trackW;
    const paint = (animate: boolean): void => {
      this.track.clear();
      this.track.fillStyle(this.value ? options.accent : 0x5b6675, 1).fillRoundedRect(trackX, -h / 2, trackW, h, h / 2);
      const knobX = this.value ? trackX + trackW - h / 2 : trackX + h / 2;
      if (animate) {
        scene.tweens.add({ targets: this.knob, x: knobX, duration: 140, ease: "Quad.easeOut" });
      } else {
        this.knob.x = knobX;
      }
    };
    paint(false);
    this.add([label, this.track, this.knob]);
    this.setSize(options.width, h * 1.4);
    this.setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.POINTER_UP, () => {
      this.value = !this.value;
      paint(true);
      options.onChange(this.value);
    });
    scene.add.existing(this);
  }
}
