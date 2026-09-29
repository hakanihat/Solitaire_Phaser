import * as Phaser from "phaser";
import { GameSession, type MoveResult } from "../core/GameSession";
import { type Hint, HintEngine } from "../core/hints";
import { PileKind } from "../core/layout";
import { encodeMoves, type Move } from "../core/moves";
import type { Rules } from "../core/Rules";
import { chooseTapMove, movesFrom } from "../core/tapMove";
import type { VariantDefinition } from "../core/variant";
import { playSfx } from "../services/audio";
import { haptic } from "../services/haptics";
import { type Settings, storage } from "../services/storage";
import { getVariant } from "../variants";
import { type Area, BoardView, DEPTH_DRAGGING } from "../view/BoardView";
import type { CardView } from "../view/CardView";
import { bouncingCascade, confetti, floatingText, ghostMove, glowCards, sparkle } from "../view/effects";
import { Hud } from "../view/Hud";
import { runSliced, wait } from "../view/scheduler";
import { openSettings } from "../view/SettingsPanel";
import { addAmbient } from "../view/ambient";
import { coverTable } from "../view/tablePainter";
import { TutorialOverlay } from "../view/TutorialOverlay";
import { Button, COLORS, Modal, Toast, textStyle } from "../view/ui";
import { uiScale } from "../view/viewport";
import { formatTime } from "./format";
import { type GameData, type LoadingData, SceneKey } from "./keys";

/** Pointer travel (in card widths) before a press becomes a drag. */
const DRAG_THRESHOLD = 0.08;

interface DragState {
  readonly pile: number;
  readonly index: number;
  readonly cards: CardView[];
  readonly offsets: Phaser.Math.Vector2[];
  readonly start: Phaser.Math.Vector2;
  /** Legal moves for these cards, by target pile. */
  readonly targets: Map<number, Move>;
  active: boolean;
}

type PendingTap = { readonly kind: "card"; readonly card: CardView } | { readonly kind: "stock" };

export class GameScene extends Phaser.Scene {
  private variant!: VariantDefinition;
  private setup!: GameData;
  private rules!: Rules;
  private session!: GameSession;
  private hints!: HintEngine;
  private boardView!: BoardView;
  private hud!: Hud;
  private toast!: Toast;
  private background?: Phaser.GameObjects.Image;
  private ambient?: Phaser.GameObjects.Particles.ParticleEmitter;
  private settings!: Settings;

  private elapsed = 0;
  private shownSecond = -1;
  private timerRunning = false;
  private won = false;
  /** Deal or auto-finish in progress: player input waits until it finishes. */
  private busy = false;
  /** Safe auto-play runs alongside player input; the token cancels a run. */
  private autoRunning = false;
  private autoToken = 0;
  private drag: DragState | null = null;
  private pendingTap: PendingTap | null = null;
  private selection: { pile: number; index: number; dispose: () => void } | null = null;
  private hintJob: (() => void) | null = null;
  private hintVisuals: (() => void)[] = [];
  private planJob: (() => void) | null = null;
  private finishPlan: readonly Move[] | null = null;
  private celebration: (() => void)[] = [];

  public constructor() {
    super(SceneKey.Game);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public create(data: GameData): void {
    this.setup = data;
    this.variant = getVariant(data.variant);
    this.rules = this.variant.createRules(data.difficulty);
    this.session = new GameSession(this.rules, data.seed);
    this.hints = new HintEngine(this.rules, this.variant.solver);
    if (data.solution) {
      this.hints.learn(this.session.board, data.solution);
    }
    this.settings = storage.settings();
    this.elapsed = data.elapsed ?? 0;
    // Phaser reuses the scene instance between games: reset per-game state.
    this.won = false;
    this.busy = false;
    this.autoRunning = false;
    this.autoToken += 1;
    this.drag = null;
    this.pendingTap = null;
    this.selection = null;
    this.hintJob = null;
    this.planJob = null;
    this.hintVisuals = [];
    this.finishPlan = null;
    this.celebration = [];

    const resuming = (data.replay?.length ?? 0) > 0;
    data.replay?.forEach((move) => this.session.play(move));
    if (!resuming) {
      storage.recordStart(this.variant.id, data.difficulty);
    }
    this.timerRunning = resuming;

    this.background = undefined;
    this.ambient = undefined;
    this.toast = new Toast(this);
    this.buildChrome();
    this.boardView = new BoardView(
      this,
      this.rules,
      this.session.board,
      this.hud.tableArea,
      this.settings.leftHanded,
      this.variant.theme.accent
    );

    if (resuming) {
      this.afterBoardChange();
    } else {
      this.dealAnimation();
    }

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  public override update(_time: number, delta: number): void {
    if (this.timerRunning && !this.won) {
      this.elapsed += delta / 1000;
      if (Math.floor(this.elapsed) !== this.shownSecond) {
        this.refreshHud();
      }
    }
  }

  private buildChrome(): void {
    this.background = coverTable(this, this.variant.theme, this.variant.id, this.background);
    this.ambient?.destroy();
    this.ambient = addAmbient(this, this.variant.theme, 16 * uiScale(this));
    this.hud?.destroy();
    this.hud = new Hud(this, this.variant, this.setup.difficulty, {
      home: () => this.goToMenu(),
      help: () => this.showTutorial(),
      undo: () => this.undo(),
      hint: () => this.requestHint(),
      auto: () => void this.autoFinish(),
      newDeal: () => this.confirmNewDeal(),
      settings: () => this.openSettings(),
    });
    this.refreshHud();
  }

  private onResize(): void {
    this.cancelDrag();
    this.buildChrome();
    this.boardView.resize(this.hud.tableArea);
    this.hud.setAutoVisible(this.finishPlan !== null);
  }

  private onShutdown(): void {
    this.persist();
    this.hintJob?.();
    this.planJob?.();
    this.clearHintVisuals();
    this.celebration.forEach((dispose) => dispose());
    this.celebration = [];
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.boardView.destroy();
    this.hud.destroy();
  }

  /** Cards fly from the stock to their places, then the tutorial (first time). */
  private dealAnimation(): void {
    this.busy = true;
    this.boardView.gatherAt(this.boardView.dealOrigin());
    playSfx(this, "shuffle");
    void this.boardView.render(this.session.board, { stagger: this.rules.cards.length > 60 ? 12 : 22 }).then(() => {
      this.busy = false;
      if (storage.tutorialSeen(this.variant.id)) {
        void this.startPlay();
      } else {
        this.showTutorial(() => void this.startPlay());
      }
    });
  }

  /** Sends any obviously safe cards home straight after the deal. */
  private async startPlay(): Promise<void> {
    await this.runAutoMoves();
    this.afterBoardChange();
  }

  // ---------------------------------------------------------------------------
  // Playing moves
  // ---------------------------------------------------------------------------

  /** Plays a move with sound, animation and feedback. Resolves false if illegal. */
  private async perform(move: Move, options: { auto?: boolean; speed?: number } = {}): Promise<boolean> {
    this.resetTransientUi();
    const result = this.session.play(move, options.auto === true);
    if (!result) {
      return false;
    }
    if (options.auto !== true) {
      haptic("drop");
    }
    // The clock starts with the player's first action, not with auto-play.
    this.timerRunning ||= options.auto !== true;
    playSfx(
      this,
      move.kind === "draw" && this.rules.pilesOf(PileKind.Waste).length === 0 ? "shuffle" : "place",
      options.auto ? 1.15 : 1
    );
    this.refreshHud();
    this.persist();
    await this.boardView.render(result.after, { speed: options.speed ?? 1, stagger: move.kind === "draw" ? 45 : 16 });
    this.celebrateProgress(result);
    if (result.won) {
      this.onWin();
      return true;
    }
    if (!options.auto) {
      await this.runAutoMoves();
      this.afterBoardChange();
    }
    return true;
  }

  /** Plays "safe" foundation moves automatically, if the player enabled it. */
  /**
   * Plays "safe" foundation moves automatically, if the player enabled it.
   * It never blocks input: the player can keep moving cards meanwhile, and
   * each step re-checks the current board. Undo cancels the run.
   */
  private async runAutoMoves(): Promise<void> {
    if (!this.settings.autoFoundation || this.autoRunning) {
      return;
    }
    this.autoRunning = true;
    const token = this.autoToken;
    for (
      let move = this.rules.safeAutoMove(this.session.board);
      move && !this.won && token === this.autoToken;
      move = this.rules.safeAutoMove(this.session.board)
    ) {
      await wait(this, 30);
      if (token !== this.autoToken || !(await this.perform(move, { auto: true, speed: 0.75 }))) {
        break;
      }
    }
    if (token === this.autoToken) {
      this.autoRunning = false;
    }
  }

  /** Sparkles on cards going home, points and combo pop-ups. */
  private celebrateProgress(result: MoveResult): void {
    const gained = this.rules.progress(result.after) - this.rules.progress(result.before);
    if (gained <= 0 || result.move.kind === "draw") {
      return;
    }
    const target = result.move.kind === "move" ? result.move.to : this.rules.pilesOf(PileKind.Foundation)[0];
    const count = result.after.piles[target]?.length ?? 0;
    const point = count > 0 ? this.boardView.cardCenter(target, count - 1) : this.boardView.dropAnchor(target);
    const font = 16 * uiScale(this);
    playSfx(this, "foundation", 1 + Math.min(result.combo, 10) * 0.04);
    sparkle(this, point.x, point.y, this.variant.theme.accent, this.boardView.cardWidth);
    if (result.points > 0) {
      floatingText(
        this,
        point.x,
        point.y - this.boardView.cardHeight * 0.3,
        `+${result.points}`,
        COLORS.text,
        font * 1.1
      );
    }
    if (this.rules.comboScoring && result.combo >= 3) {
      floatingText(
        this,
        this.scale.width / 2,
        this.hud.tableArea.y + this.hud.tableArea.height * 0.55,
        `Combo ×${result.combo}!`,
        this.variant.theme.accent,
        font * (1.6 + Math.min(result.combo, 12) * 0.08)
      );
    }
  }

  /** Housekeeping after any change: HUD, auto-finish availability, dead ends. */
  private afterBoardChange(): void {
    this.refreshHud();
    this.checkAutoFinish();
    const board = this.session.board;
    if (!this.won && this.rules.usefulMoves(board).length === 0 && !this.rules.canDraw(board)) {
      this.showToast("No moves left. Undo, or start a new deal.");
    }
  }

  private undo(): void {
    if (this.busy || this.won || !this.session.undo()) {
      return;
    }
    // Stop any auto-play run so it doesn't immediately replay what was undone.
    this.autoToken += 1;
    this.autoRunning = false;
    this.resetTransientUi();
    playSfx(this, "place", 0.9);
    void this.boardView.render(this.session.board, { speed: 0.8 });
    this.persist();
    this.afterBoardChange();
  }

  // ---------------------------------------------------------------------------
  // Input: drag & drop and tap-to-move
  // ---------------------------------------------------------------------------

  private canInteract(): boolean {
    return (
      !this.busy &&
      !this.won &&
      !this.children.list.some((child) => child instanceof Modal || child instanceof TutorialOverlay)
    );
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    this.pendingTap = null;
    if (!this.canInteract() || over.length > 0) {
      return;
    }
    const board = this.session.board;
    const card = this.boardView.cardAt(pointer.x, pointer.y);
    const stockPile = this.rules.pilesOf(PileKind.Stock)[0];
    if (!card) {
      if (stockPile !== undefined && this.boardView.pileAt(pointer.x, pointer.y) === stockPile) {
        this.pendingTap = { kind: "stock" };
      }
      return;
    }
    if (card.pile === stockPile) {
      this.pendingTap = { kind: "stock" };
      return;
    }
    this.pendingTap = { kind: "card", card };
    if (!this.rules.canPick(board, card.pile, card.index)) {
      return;
    }
    const cards = this.boardView.cardsFrom(card.pile, card.index);
    const targets = new Map<number, Move>();
    movesFrom(this.rules, board, card.pile, card.index).forEach((move) => {
      const to = move.kind === "move" ? move.to : move.kind === "pair" ? move.b : -1;
      if (to >= 0) {
        targets.set(to, move);
      }
    });
    this.drag = {
      pile: card.pile,
      index: card.index,
      cards,
      offsets: cards.map((c) => new Phaser.Math.Vector2(c.x - pointer.x, c.y - pointer.y)),
      start: new Phaser.Math.Vector2(pointer.x, pointer.y),
      targets,
      active: false,
    };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag || !pointer.isDown) {
      return;
    }
    if (!drag.active) {
      if (
        Phaser.Math.Distance.Between(pointer.x, pointer.y, drag.start.x, drag.start.y) <
        this.boardView.cardWidth * DRAG_THRESHOLD
      ) {
        return;
      }
      drag.active = true;
      this.pendingTap = null;
      this.resetTransientUi();
      drag.cards.forEach((card, i) => {
        card.settle();
        card.setDepth(DEPTH_DRAGGING + i);
        card.setLifted(true);
      });
      this.boardView.showTargets([...drag.targets.keys()]);
    }
    drag.cards.forEach((card, i) => {
      card.setPosition(pointer.x + drag.offsets[i].x, pointer.y + drag.offsets[i].y);
      card.leanTowards(pointer.velocity.x / uiScale(this));
    });
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    this.drag = null;
    if (drag?.active) {
      this.boardView.clearTargets();
      const move = this.dropMove(drag, pointer);
      if (move) {
        void this.perform(move);
      } else {
        const overSomething =
          this.boardView.pileAt(pointer.x, pointer.y) !== undefined &&
          this.boardView.pileAt(pointer.x, pointer.y) !== drag.pile;
        if (overSomething) {
          playSfx(this, "invalid");
          haptic("invalid");
        }
        void this.boardView.render(this.session.board, { speed: 0.8 });
      }
      return;
    }
    const tap = this.pendingTap;
    this.pendingTap = null;
    if (tap && this.canInteract()) {
      this.handleTap(tap);
    }
  }

  /** The legal target with the largest overlap under the dragged cards. */
  private dropMove(drag: DragState, pointer: Phaser.Input.Pointer): Move | null {
    const lead = drag.cards[0].getBounds();
    let best: { move: Move; area: number } | null = null;
    drag.targets.forEach((move, pile) => {
      const zone = this.boardView.dropZone(pile);
      const overlap = Phaser.Geom.Rectangle.Intersection(lead, zone);
      const area =
        overlap.width * overlap.height + (zone.contains(pointer.x, pointer.y) ? lead.width * lead.height : 0);
      if (area > 0 && (!best || area > best.area)) {
        best = { move, area };
      }
    });
    return (best as { move: Move } | null)?.move ?? null;
  }

  private cancelDrag(): void {
    if (this.drag?.active) {
      this.boardView.clearTargets();
      void this.boardView.render(this.session.board, { animate: false });
    }
    this.drag = null;
  }

  private handleTap(tap: PendingTap): void {
    const board = this.session.board;
    if (tap.kind === "stock") {
      if (this.rules.canDraw(board)) {
        void this.perform({ kind: "draw" });
      } else {
        playSfx(this, "invalid");
        this.showToast(this.rules.drawBlockedReason(board));
      }
      return;
    }
    const { card } = tap;
    // Second tap of a Pyramid pair.
    if (this.selection) {
      const selected = this.selection;
      this.clearSelection();
      const pair = movesFrom(this.rules, board, selected.pile, selected.index).find(
        (move) => move.kind === "pair" && move.b === card.pile
      );
      if (pair) {
        void this.perform(pair);
        return;
      }
      if (selected.pile === card.pile) {
        return;
      }
    }
    if (!this.rules.canPick(board, card.pile, card.index)) {
      card.shake();
      return;
    }
    const tapAlways = this.rules.comboScoring || this.rules.pilesOf(PileKind.Slot).length > 0;
    if (!this.settings.tapToMove && !tapAlways) {
      return;
    }
    const candidates = movesFrom(this.rules, board, card.pile, card.index);
    if (candidates.length > 1 && candidates.every((move) => move.kind === "pair")) {
      // Several possible partners: let the player pick one.
      const partners = candidates.flatMap((move) =>
        move.kind === "pair" ? this.boardView.cardsFrom(move.b, board.piles[move.b].length - 1) : []
      );
      const dispose = glowCards(this, [card, ...partners], this.variant.theme.accent);
      this.selection = { pile: card.pile, index: card.index, dispose };
      card.bump();
      return;
    }
    const preferred = this.hints.knownLine(board)?.[0];
    const move = chooseTapMove(this.rules, board, card.pile, card.index, preferred);
    if (move) {
      void this.perform(move);
    } else {
      playSfx(this, "invalid");
      haptic("invalid");
      this.boardView.cardsFrom(card.pile, card.index).forEach((c) => c.shake());
    }
  }

  private clearSelection(): void {
    this.selection?.dispose();
    this.selection = null;
  }

  // ---------------------------------------------------------------------------
  // Hints and auto-finish
  // ---------------------------------------------------------------------------

  private requestHint(): void {
    if (!this.canInteract() || this.hintJob) {
      return;
    }
    this.resetTransientUi();
    const board = this.session.board;
    this.hud.hintButton.setPulse(true);
    this.hintJob = runSliced(this, this.hints.think(board, this.session.previousBoards()), (hint) => {
      this.hintJob = null;
      this.hud.hintButton.setPulse(false);
      if (this.session.board === board) {
        this.showHint(hint);
      }
    });
  }

  private showHint(hint: Hint): void {
    const accent = this.variant.theme.accent;
    const board = this.session.board;
    if (hint.kind === "move") {
      const { move } = hint;
      if (move.kind === "draw") {
        const stock = this.rules.pilesOf(PileKind.Stock)[0];
        const top = board.piles[stock].length - 1;
        this.hintVisuals.push(glowCards(this, top >= 0 ? this.boardView.cardsFrom(stock, top) : [], accent));
      } else if (move.kind === "pair") {
        const cards = [move.a, move.b].flatMap((pile) => this.boardView.cardsFrom(pile, board.piles[pile].length - 1));
        this.hintVisuals.push(glowCards(this, cards, accent));
      } else {
        const cards = this.boardView.cardsFrom(move.from, board.piles[move.from].length - move.count);
        this.hintVisuals.push(glowCards(this, cards, accent));
        this.hintVisuals.push(
          ghostMove(this, cards, this.boardView.dropAnchor(move.to), this.boardView.cardHeight * 0.29)
        );
      }
      this.showToast(hint.winning ? `${hint.text}  ✓` : hint.text);
      return;
    }
    if (hint.kind === "undo") {
      this.hud.undoButton.setPulse(true);
      this.hintVisuals.push(() => this.hud.undoButton.setPulse(false));
    }
    this.showToast(hint.text, 4500);
  }

  private clearHintVisuals(): void {
    this.hintVisuals.splice(0).forEach((dispose) => dispose());
  }

  /** Looks for a guaranteed finish once nothing is hidden any more. */
  private checkAutoFinish(): void {
    this.planJob?.();
    this.planJob = null;
    this.finishPlan = null;
    this.hud.setAutoVisible(false);
    const board = this.session.board;
    if (this.won || !this.rules.canAutoFinish(board)) {
      return;
    }
    this.planJob = runSliced(this, this.hints.planFinish(board), (plan) => {
      this.planJob = null;
      if (plan && plan.length > 1 && this.session.board === board) {
        this.finishPlan = plan;
        this.hud.setAutoVisible(true);
      }
    });
  }

  private async autoFinish(): Promise<void> {
    const plan = this.finishPlan;
    if (!plan || !this.canInteract()) {
      return;
    }
    this.finishPlan = null;
    this.hud.setAutoVisible(false);
    this.busy = true;
    for (const move of plan) {
      if (this.won || !(await this.perform(move, { auto: true, speed: 0.45 }))) {
        break;
      }
    }
    this.busy = false;
    if (!this.won) {
      this.afterBoardChange();
    }
  }

  /** Clears hint glows, selections and pending searches that a move makes stale. */
  private resetTransientUi(): void {
    this.hintJob?.();
    this.hintJob = null;
    this.hud.hintButton.setPulse(false);
    this.clearHintVisuals();
    this.clearSelection();
    this.toast.hide();
  }

  // ---------------------------------------------------------------------------
  // Winning, menus and persistence
  // ---------------------------------------------------------------------------

  private onWin(): void {
    this.won = true;
    this.timerRunning = false;
    this.planJob?.();
    this.hud.setAutoVisible(false);
    storage.clearSavedGame();
    const time = Math.round(this.elapsed);
    const timeBonus = Math.round(20_000 / Math.max(time, 30)) * 5;
    const score = this.session.score + timeBonus;
    const record = storage.recordWin(this.variant.id, this.setup.difficulty, {
      time,
      score,
      moves: this.session.moves,
    });
    playSfx(this, "win");
    haptic("win");
    const { accent, table } = this.variant.theme;
    const emitter = confetti(this, [accent, 0xffffff, table[0], 0xff6b6b, 0x4dd0e1]);
    const cards = [...this.boardView.cards].sort((a, b) => b.depth - a.depth);
    this.celebration.push(bouncingCascade(this, cards), () => emitter.destroy());
    this.time.delayedCall(1900, () => this.showWinPanel({ time, timeBonus, score, ...record }));
  }

  private showWinPanel(result: {
    time: number;
    timeBonus: number;
    score: number;
    newBestTime: boolean;
    newBestScore: boolean;
    stats: { streak: number; won: number };
  }): void {
    const font = 16 * uiScale(this);
    const accent = this.variant.theme.accent;
    const width = Math.min(this.scale.width * 0.9, font * 22);
    const height = font * 19;
    const modal = new Modal(this, {
      width,
      height,
      title: "You won!",
      titleSize: font * 2,
      accent,
      dismissible: false,
    });
    const rows: [string, string, boolean][] = [
      ["Time", formatTime(result.time), result.newBestTime],
      ["Moves", String(this.session.moves), false],
      ["Time bonus", `+${result.timeBonus}`, false],
      ["Score", String(result.score), result.newBestScore],
      ["Win streak", String(result.stats.streak), false],
    ];
    rows.forEach(([label, value, best], i) => {
      const y = -height / 2 + font * 5 + i * font * 1.9;
      modal.panel.add(
        this.add.text(-width / 2 + font * 1.5, y, label, textStyle(font, COLORS.muted)).setOrigin(0, 0.5)
      );
      modal.panel.add(
        this.add
          .text(
            width / 2 - font * 1.5,
            y,
            best ? `${value}  ★ best` : value,
            textStyle(font, best ? accent : COLORS.text, true)
          )
          .setOrigin(1, 0.5)
      );
    });
    const y = height / 2 - font * 2.4;
    modal.panel.add(
      new Button(this, -width / 4, y, {
        width: width * 0.42,
        height: font * 2.8,
        icon: "home",
        label: "Menu",
        style: "ghost",
        accent,
        fontSize: font,
        onClick: () => this.goToMenu(),
      })
    );
    modal.panel.add(
      new Button(this, width / 4, y, {
        width: width * 0.42,
        height: font * 2.8,
        icon: "deal",
        label: "Next deal",
        style: "primary",
        accent,
        fontSize: font,
        onClick: () => this.startNewDeal(),
      })
    );
  }

  private confirmNewDeal(): void {
    if (this.busy || this.won || this.session.moves === 0) {
      this.startNewDeal();
      return;
    }
    const font = 16 * uiScale(this);
    const accent = this.variant.theme.accent;
    const width = Math.min(this.scale.width * 0.9, font * 22);
    const height = font * 11;
    const modal = new Modal(this, { width, height, title: "New deal?", titleSize: font * 1.5, accent });
    modal.panel.add(
      this.add
        .text(0, -font * 1.2, "This game will count as a loss\nand end your win streak.", {
          ...textStyle(font, COLORS.muted),
          align: "center",
        })
        .setOrigin(0.5)
    );
    const y = height / 2 - font * 2.4;
    modal.panel.add(
      new Button(this, -width / 4, y, {
        width: width * 0.42,
        height: font * 2.8,
        label: "Keep playing",
        style: "ghost",
        accent,
        fontSize: font * 0.9,
        onClick: () => modal.close(),
      })
    );
    modal.panel.add(
      new Button(this, width / 4, y, {
        width: width * 0.42,
        height: font * 2.8,
        label: "Deal",
        style: "primary",
        accent,
        fontSize: font,
        onClick: () => {
          storage.recordAbandon(this.variant.id, this.setup.difficulty);
          this.startNewDeal();
        },
      })
    );
  }

  private startNewDeal(): void {
    storage.clearSavedGame();
    this.won = true; // stops persisting this game while leaving
    this.transition(SceneKey.Loading, { variant: this.variant.id, difficulty: this.setup.difficulty });
  }

  /** Leaving keeps an unfinished game saved, so it can be resumed from the menu. */
  private goToMenu(): void {
    this.transition(SceneKey.Menu);
  }

  private transition(key: string, data?: LoadingData): void {
    this.input.enabled = false;
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.input.enabled = true;
      this.scene.start(key, data);
    });
  }

  private showTutorial(onClose?: () => void): void {
    if (this.children.list.some((child) => child instanceof TutorialOverlay)) {
      return;
    }
    this.resetTransientUi();
    storage.markTutorialSeen(this.variant.id);
    new TutorialOverlay(this, this.variant, {
      spotlight: (kinds) => this.boardView.pileBoundsOfKind(kinds),
      onClose: () => onClose?.(),
    });
  }

  private openSettings(): void {
    const leftHanded = this.settings.leftHanded;
    openSettings(this, this.variant.theme.accent, (settings) => {
      this.settings = settings;
      this.refreshHud();
      if (settings.leftHanded !== leftHanded) {
        // Mirroring the table needs a fresh board view.
        this.boardView.destroy();
        this.boardView = new BoardView(
          this,
          this.rules,
          this.session.board,
          this.hud.tableArea,
          settings.leftHanded,
          this.variant.theme.accent
        );
      }
    });
  }

  private refreshHud(): void {
    this.shownSecond = Math.floor(this.elapsed);
    this.hud.update({
      time: this.elapsed,
      moves: this.session.moves,
      score: this.session.score,
      showTimer: this.settings.showTimer,
    });
    this.hud.undoButton.setEnabled(this.session.canUndo && !this.won);
  }

  private showToast(message: string, duration?: number): void {
    const font = 16 * uiScale(this);
    const area: Area = this.hud.tableArea;
    this.toast.show(message, {
      y: area.y + area.height - font * 2.2,
      fontSize: font * 0.9,
      accent: this.variant.theme.accent,
      duration,
    });
  }

  private persist(): void {
    if (this.won || this.session.moves === 0) {
      return;
    }
    storage.saveGame({
      variant: this.variant.id,
      difficulty: this.setup.difficulty,
      seed: this.setup.seed,
      moves: encodeMoves(this.session.movesPlayed),
      elapsed: this.elapsed,
      solution: this.setup.solution ? encodeMoves(this.setup.solution) : undefined,
    });
  }
}
