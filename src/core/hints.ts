import type { Board } from "./board";
import type { Move } from "./moves";
import type { Rules } from "./Rules";
import { Solver } from "./solver";
import type { SolverProfile } from "./variant";

export type Hint =
  /** `winning` is true when the move is on a verified winning line. */
  | { readonly kind: "move"; readonly move: Move; readonly text: string; readonly winning: boolean }
  | { readonly kind: "undo"; readonly steps: number; readonly text: string }
  | { readonly kind: "stuck"; readonly text: string };

/** Positions expanded between yields, keeping each slice to a few ms. */
const SLICE = 250;
/** How far back the dead-end analysis looks for a winnable position. */
const MAX_BACKTRACK = 40;
/** Moves that recreate one of this many recent positions count as undoing play. */
const RECENT_POSITIONS = 8;

interface LineEntry {
  readonly path: readonly Move[];
  readonly index: number;
}

/**
 * The hint AI. Work is done in generators that yield regularly so callers
 * can spread a search over several animation frames.
 */
export class HintEngine {
  /** Position key → where that position sits on a known winning line. */
  private readonly lines = new Map<string, LineEntry>();

  public constructor(
    private readonly rules: Rules,
    private readonly profile: SolverProfile
  ) {}

  /** Remembers a winning line so every position along it answers instantly. */
  public learn(start: Board, path: readonly Move[]): void {
    let board = start;
    for (let index = 0; index <= path.length; index += 1) {
      this.lines.set(this.rules.positionKey(board), { path, index });
      if (index < path.length) {
        board = this.rules.apply(board, path[index]);
      }
    }
  }

  /** The rest of a known winning line from this position, if any. */
  public knownLine(board: Board): readonly Move[] | null {
    const entry = this.lines.get(this.rules.positionKey(board));
    return entry ? entry.path.slice(entry.index) : null;
  }

  /** Finds a hint for `board`. `history` lists earlier boards, most recent first. */
  public *think(board: Board, history: readonly Board[]): Generator<void, Hint> {
    const known = this.knownLine(board);
    if (known && known.length > 0) {
      return this.moveHint(board, known[0], true);
    }
    const search = new Solver(this.rules, board, { maxNodes: this.profile.hintNodes, strategy: this.profile.strategy });
    while (!search.step(SLICE)) {
      yield;
    }
    const { status, path } = search.result;
    if (status === "solved" && path.length > 0) {
      this.learn(board, path);
      return this.moveHint(board, path[0], true);
    }
    if (status === "unsolvable") {
      return yield* this.findWayBack(history);
    }
    return this.heuristicHint(board, history);
  }

  /** Plans the rest of the game for auto-finish, or null if none was found. */
  public *planFinish(board: Board): Generator<void, readonly Move[] | null> {
    const known = this.knownLine(board);
    if (known) {
      return known;
    }
    const search = new Solver(this.rules, board, {
      maxNodes: this.profile.verifyNodes,
      strategy: this.profile.strategy,
    });
    while (!search.step(SLICE)) {
      yield;
    }
    if (search.result.status !== "solved") {
      return null;
    }
    this.learn(board, search.result.path);
    return search.result.path;
  }

  /** The position is lost: find how many undos lead back to a winnable one. */
  private *findWayBack(history: readonly Board[]): Generator<void, Hint> {
    const candidates = history.slice(0, MAX_BACKTRACK);
    const known = candidates.findIndex((previous) => this.knownLine(previous) !== null);
    if (known >= 0) {
      return this.undoHint(known + 1);
    }
    const budget = Math.max(2_000, Math.floor(this.profile.hintNodes / 8));
    for (let i = 0; i < candidates.length; i += 1) {
      const search = new Solver(this.rules, candidates[i], { maxNodes: budget, strategy: this.profile.strategy });
      while (!search.step(SLICE)) {
        yield;
      }
      if (search.result.status === "solved") {
        this.learn(candidates[i], search.result.path);
        return this.undoHint(i + 1);
      }
    }
    return { kind: "stuck", text: "This deal can no longer be won from here. Undo further back or start a new deal." };
  }

  /** Best rule-of-thumb move that doesn't simply walk back into recent play. */
  private heuristicHint(board: Board, history: readonly Board[]): Hint {
    const recent = new Set(history.slice(0, RECENT_POSITIONS).map((previous) => this.rules.positionKey(previous)));
    const forced = this.rules.safeAutoMove(board);
    const ranked = (forced ? [forced] : this.rules.usefulMoves(board))
      .filter((move) => !recent.has(this.rules.positionKey(this.rules.apply(board, move))))
      .sort((a, b) => this.rules.moveHeuristic(board, b) - this.rules.moveHeuristic(board, a));
    const best = ranked[0];
    if (best) {
      return this.moveHint(board, best, false);
    }
    return { kind: "stuck", text: "No useful moves left. Try Undo, or start a new deal." };
  }

  private moveHint(board: Board, move: Move, winning: boolean): Hint {
    return { kind: "move", move, text: this.rules.describeMove(board, move), winning };
  }

  private undoHint(steps: number): Hint {
    const plural = steps === 1 ? "move" : "moves";
    return {
      kind: "undo",
      steps,
      text: `No win is possible from here. Undo ${steps} ${plural} to get back on a winning track.`,
    };
  }
}

/** Runs a generator to completion synchronously (tests and offline scripts). */
export function runToEnd<T>(task: Generator<void, T>): T {
  for (;;) {
    const step = task.next();
    if (step.done === true) {
      return step.value;
    }
  }
}
