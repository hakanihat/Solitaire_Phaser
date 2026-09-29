import * as Phaser from "phaser";
import { decodeMoves, type Move } from "../core/moves";
import { createRng, randomSeed, shuffle } from "../core/random";
import type { Rules } from "../core/Rules";
import { Solver } from "../core/solver";
import type { VariantDefinition } from "../core/variant";
import { type Deal, loadDealList, nextDeal } from "../services/deals";
import { storage } from "../services/storage";
import { getVariant } from "../variants";
import { cardImage } from "../view/cardAtlas";
import { BACK_FRAME, CARD_ASPECT, frameOf } from "../view/CardView";
import { INTROS } from "../view/intros";
import { addAmbient } from "../view/ambient";
import { coverTable } from "../view/tablePainter";
import { COLORS, hex, textStyle } from "../view/ui";
import { uiScale } from "../view/viewport";
import { type GameData, type LoadingData, SceneKey } from "./keys";

/** How long the finished intro stays on screen before the game starts. */
const HOLD_AFTER_INTRO = 900;
/** Intro choreography timings (ms). */
const FLY_IN = { start: 250, stagger: 90, duration: 650 };
const FLIP_WAVE = { stagger: 70, duration: 260 };
/** Per-frame time slice for any solving done here. */
const SLICE_MS = 10;

/**
 * Themed loading screen for each game. It does real work while the intro
 * plays: fetches the deal list, picks the player's next deal and re-verifies
 * its winning line by replaying it through the rules.
 */
export class LoadingScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private progress = 0;

  public constructor() {
    super(SceneKey.Loading);
  }

  public create(data: LoadingData): void {
    const variant = getVariant(data.variant);
    const { width, height } = this.scale;
    const ui = uiScale(this);
    const font = 16 * ui;
    const accent = variant.theme.accent;

    coverTable(this, variant.theme, variant.id);
    addAmbient(this, variant.theme, font);
    this.introDone = false;
    this.leaving = false;
    this.gameData = null;
    // A scene timer, not `time.now`: the clock hasn't ticked yet during create().
    this.time.delayedCall(this.playIntro(variant, font) + HOLD_AFTER_INTRO, () => {
      this.introDone = true;
      this.maybeStart();
    });

    const title = this.add
      .text(width / 2, height * 0.16, variant.name, textStyle(font * 2.8, accent, true))
      .setOrigin(0.5);
    title.setShadow(0, font * 0.18, "#000000", font * 0.5, false, true);
    const chip = this.add
      .text(
        width / 2,
        height * 0.16 + font * 2.6,
        `${variant.difficulties[data.difficulty].label.toUpperCase()}${variant.original ? " · ORIGINAL GAME" : ""}`,
        {
          ...textStyle(font * 0.75, COLORS.textDark, true),
          backgroundColor: hex(accent),
          padding: { x: font * 0.6, y: font * 0.25 },
        }
      )
      .setOrigin(0.5);
    const tip = variant.tutorial[Math.floor(Math.random() * variant.tutorial.length)];
    this.add
      .text(width / 2, height * 0.8, `${tip.title}: ${tip.text}`, {
        ...textStyle(font * 0.85, COLORS.text),
        align: "center",
        wordWrap: { width: Math.min(width * 0.86, font * 28) },
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.85);

    const barW = Math.min(width * 0.6, font * 18);
    const barY = height * 0.74;
    this.add
      .graphics()
      .fillStyle(0x000000, 0.35)
      .fillRoundedRect((width - barW) / 2, barY, barW, font * 0.5, font * 0.25);
    this.progressBar = this.add.graphics();
    this.status = this.add.text(width / 2, barY - font * 1.1, "", textStyle(font * 0.8, COLORS.muted)).setOrigin(0.5);
    this.drawProgress = (): void => {
      this.progressBar.clear();
      this.progressBar
        .fillStyle(accent, 1)
        .fillRoundedRect((width - barW) / 2, barY, Math.max(font * 0.5, barW * this.progress), font * 0.5, font * 0.25);
    };

    [title, chip].forEach((item, i) => {
      item.setAlpha(0).setY(item.y - font);
      this.tweens.add({
        targets: item,
        alpha: 1,
        y: item.y + font,
        duration: 450,
        delay: 120 + i * 120,
        ease: "Back.easeOut",
      });
    });
    this.cameras.main.fadeIn(250, 0, 0, 0);
    void this.prepare(variant, data);
  }

  private drawProgress: () => void = () => undefined;
  private introDone = false;
  private leaving = false;
  private gameData: GameData | null = null;
  private cardGroup?: Phaser.GameObjects.Container;

  private setProgress(value: number, message?: string): void {
    this.progress = Math.max(this.progress, value);
    this.drawProgress();
    if (message !== undefined) {
      this.status.setText(message);
    }
  }

  private async prepare(variant: VariantDefinition, data: LoadingData): Promise<void> {
    const rules = variant.createRules(data.difficulty);
    let gameData: GameData | null = data.resume ? this.restoreSaved(rules) : null;

    if (!gameData) {
      this.setProgress(0.1, "Shuffling the deck…");
      const list = await loadDealList(variant.id);
      this.setProgress(0.4, "Checking the deal is winnable…");
      let deal = nextDeal(list, variant.id, data.difficulty);
      if (!deal || !this.verifies(rules, deal)) {
        deal = await this.findWinnableDeal(variant, rules);
      }
      gameData = { variant: variant.id, difficulty: data.difficulty, seed: deal.seed, solution: deal.solution };
    }

    this.gameData = gameData;
    this.setProgress(1, "Ready! Tap to start");
    // Continue once the intro has played out — or right away on a tap.
    this.input.once(Phaser.Input.Events.POINTER_UP, () => this.maybeStart(true));
    this.maybeStart();
  }

  private maybeStart(skipIntro = false): void {
    const data = this.gameData;
    if (!data || this.leaving || !(this.introDone || skipIntro)) {
      return;
    }
    this.leaving = true;
    this.outro();
    this.cameras.main.fadeOut(380, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(SceneKey.Game, data)
    );
  }

  /** Rebuilds a saved game, validating every stored move against the rules. */
  private restoreSaved(rules: Rules): GameData | null {
    const saved = storage.savedGame();
    if (!saved) {
      return null;
    }
    try {
      const replay = decodeMoves(saved.moves);
      let board = rules.deal(saved.seed);
      for (const move of replay) {
        if (!rules.isLegal(board, move)) {
          throw new Error("Saved game does not replay");
        }
        board = rules.apply(board, move);
      }
      this.setProgress(0.8, "Restoring your game…");
      return {
        variant: saved.variant,
        difficulty: saved.difficulty,
        seed: saved.seed,
        solution: saved.solution ? decodeMoves(saved.solution) : null,
        replay,
        elapsed: saved.elapsed,
      };
    } catch {
      storage.clearSavedGame();
      return null;
    }
  }

  /** Independent re-check that a shipped winning line really wins this deal. */
  private verifies(rules: Rules, deal: Deal): boolean {
    if (!deal.solution) {
      return false;
    }
    let board = rules.deal(deal.seed);
    for (const move of deal.solution) {
      if (!rules.isLegal(board, move)) {
        return false;
      }
      board = rules.apply(board, move);
    }
    return rules.isWon(board);
  }

  /**
   * Fallback when no pre-verified list is available: solve random deals live,
   * a few milliseconds per frame, until one is proven winnable.
   */
  private async findWinnableDeal(variant: VariantDefinition, rules: Rules): Promise<Deal> {
    this.setProgress(0.45, "Finding a winnable deal…");
    for (let attempt = 1; ; attempt += 1) {
      const seed = randomSeed();
      const solver = new Solver(rules, rules.deal(seed), {
        maxNodes: variant.solver.verifyNodes,
        strategy: variant.solver.strategy,
      });
      while (!solver.done) {
        const frameStart = performance.now();
        while (!solver.done && performance.now() - frameStart < SLICE_MS) {
          solver.step(200);
        }
        this.setProgress(0.45 + 0.5 * (1 - 1 / (attempt + solver.effort)));
        await new Promise((resolve) => this.time.delayedCall(0, resolve));
      }
      const path: readonly Move[] = solver.result.path;
      if (solver.result.status === "solved") {
        return { seed, solution: path };
      }
    }
  }

  /**
   * Deals the themed card arrangement that introduces this game: cards fly
   * in one by one, turn over in a wave, then float. Returns its length (ms).
   */
  private playIntro(variant: VariantDefinition, font: number): number {
    const { width, height } = this.scale;
    const slots = INTROS[variant.theme.intro]();
    const spread = Math.max(...slots.map((slot) => Math.abs(slot.x))) + 0.6;
    const cardW = Math.min((width * 0.42) / spread, font * 4.2);
    const cardH = cardW * CARD_ASPECT;
    const rules = variant.createRules("medium");
    const faces = shuffle([...rules.cards], createRng(variant.id.length * 7919));
    const group = this.add.container(width / 2, height * 0.46);
    this.cardGroup = group;
    const landed = FLY_IN.start + slots.length * FLY_IN.stagger + FLY_IN.duration;

    slots.forEach((slot, i) => {
      const card = cardImage(this, 0, height * 0.5, BACK_FRAME, cardW);
      group.add(card);
      const baseScaleX = card.scaleX;
      this.tweens.add({
        targets: card,
        x: slot.x * cardW,
        y: slot.y * cardH,
        angle: slot.angle,
        duration: FLY_IN.duration,
        delay: FLY_IN.start + i * FLY_IN.stagger,
        ease: "Back.easeOut",
      });
      // Once every card has landed, they turn over one after another.
      this.tweens.add({
        targets: card,
        scaleX: 0,
        duration: FLIP_WAVE.duration / 2,
        delay: landed + i * FLIP_WAVE.stagger,
        yoyo: true,
        ease: "Sine.easeIn",
        onYoyo: () => card.setFrame(frameOf(faces[i % faces.length])),
        onComplete: () => {
          card.setScale(baseScaleX, card.scaleY);
          this.tweens.add({
            targets: card,
            y: card.y - cardH * 0.05,
            duration: 1200 + (i % 4) * 150,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        },
      });
    });
    if (variant.theme.intro === "spiral") {
      this.tweens.add({ targets: group, angle: 360, duration: 24000, repeat: -1 });
    }
    return landed + slots.length * FLIP_WAVE.stagger + FLIP_WAVE.duration;
  }

  /** The cards gather into a deck as the screen fades out. */
  private outro(): void {
    this.cardGroup?.each((card: Phaser.GameObjects.Image) => {
      this.tweens.killTweensOf(card);
      this.tweens.add({ targets: card, x: 0, y: 0, angle: 0, duration: 360, ease: "Cubic.easeIn" });
    });
  }
}
