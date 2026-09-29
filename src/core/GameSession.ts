import type { Board } from "./board";
import { PileKind } from "./layout";
import type { Move } from "./moves";
import type { Rules } from "./Rules";

const POINTS_PER_CARD = 10;
const POINTS_PER_REVEAL = 5;

interface Snapshot {
  readonly board: Board;
  /** Whether the move made from this position was automatic. */
  readonly auto: boolean;
  readonly score: number;
  readonly combo: number;
  readonly moves: number;
}

export interface MoveResult {
  readonly move: Move;
  readonly before: Board;
  readonly after: Board;
  readonly points: number;
  /** Current combo length (combo-scoring games only). */
  readonly combo: number;
  readonly won: boolean;
}

/**
 * One game in progress: the current board plus everything needed for undo and
 * scoring. It knows nothing about rendering; scenes observe the results.
 */
export class GameSession {
  private readonly history: Snapshot[] = [];
  private readonly played: Move[] = [];
  private current: Board;
  private scoreValue = 0;
  private comboValue = 0;
  private movesValue = 0;

  public constructor(
    public readonly rules: Rules,
    public readonly seed: number
  ) {
    this.current = rules.deal(seed);
  }

  public get board(): Board {
    return this.current;
  }

  public get score(): number {
    return this.scoreValue;
  }

  public get moves(): number {
    return this.movesValue;
  }

  public get combo(): number {
    return this.comboValue;
  }

  public get canUndo(): boolean {
    return this.history.length > 0;
  }

  public get isWon(): boolean {
    return this.rules.isWon(this.current);
  }

  public get progress(): number {
    return this.rules.progress(this.current) / this.rules.goal();
  }

  /** Moves played so far, oldest first (saved to resume the game later). */
  public get movesPlayed(): readonly Move[] {
    return this.played;
  }

  /** Earlier boards, most recent first (used by the hint AI's dead-end check). */
  public previousBoards(): Board[] {
    return this.history.map((entry) => entry.board).reverse();
  }

  /**
   * Plays a move if it is legal. Returns what changed, or null if illegal.
   * Automatic moves (auto-play, auto-finish) are undone together with the
   * player move that triggered them.
   */
  public play(move: Move, auto = false): MoveResult | null {
    if (!this.rules.isLegal(this.current, move)) {
      return null;
    }
    const before = this.current;
    this.history.push({ board: before, auto, score: this.scoreValue, combo: this.comboValue, moves: this.movesValue });
    const after = this.rules.apply(before, move);
    const points = this.scoreMove(before, after, move);
    this.current = after;
    this.played.push(move);
    this.scoreValue += points;
    this.movesValue += 1;
    return { move, before, after, points, combo: this.comboValue, won: this.rules.isWon(after) };
  }

  /**
   * Reverts the last player move together with any automatic moves that
   * followed it. Returns the board that was undone, or null.
   */
  public undo(): Board | null {
    let snapshot = this.history.pop();
    if (!snapshot) {
      return null;
    }
    this.played.pop();
    while (snapshot.auto && this.history.length > 0) {
      snapshot = this.history.pop() as Snapshot;
      this.played.pop();
    }
    const undone = this.current;
    this.current = snapshot.board;
    this.scoreValue = snapshot.score;
    this.comboValue = snapshot.combo;
    this.movesValue = snapshot.moves;
    return undone;
  }

  private scoreMove(before: Board, after: Board, move: Move): number {
    const gained = Math.max(0, this.rules.progress(after) - this.rules.progress(before));
    const revealed = before.hidden.reduce(
      (sum, hidden, pile) =>
        sum +
        Math.max(0, hidden - after.hidden[pile]) * (after.piles[pile].length > 0 && this.isPlayArea(pile) ? 1 : 0),
      0
    );
    if (!this.rules.comboScoring) {
      return gained * POINTS_PER_CARD + revealed * POINTS_PER_REVEAL;
    }
    if (move.kind === "draw") {
      this.comboValue = 0;
      return 0;
    }
    let points = 0;
    for (let i = 0; i < gained; i += 1) {
      this.comboValue += 1;
      points += POINTS_PER_CARD * this.comboValue;
    }
    return points + revealed * POINTS_PER_REVEAL;
  }

  /** Stock and waste flips are not "reveals" worth points. */
  private isPlayArea(pile: number): boolean {
    const kind = this.rules.kindOf(pile);
    return kind === PileKind.Tableau || kind === PileKind.Slot;
  }
}
