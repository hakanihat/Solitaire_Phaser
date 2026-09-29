import type { Board } from "./board";
import { MaxHeap } from "./heap";
import type { Move } from "./moves";
import type { Rules } from "./Rules";

export type SolveStatus = "solved" | "unsolvable" | "unknown" | "running";

/**
 * - "depth-first": follows the variant's move ordering greedily. Very fast
 *   when forced safe moves prune well (Klondike family).
 * - "best-first": always expands the most promising position according to
 *   `Rules.evaluate`, with a small penalty per move. Finds shorter, more
 *   natural solutions in open games (FreeCell, Meridian, Golf …).
 */
export type SearchStrategy = "depth-first" | "best-first";

export interface SolveResult {
  readonly status: SolveStatus;
  /** Winning line from the start position (only when solved). */
  readonly path: readonly Move[];
  /** Positions expanded; a good measure of how hard the deal is. */
  readonly nodes: number;
}

export interface SolverOptions {
  /** Give up (status "unknown") after expanding this many positions. */
  readonly maxNodes: number;
  /** Solutions longer than this are not explored. */
  readonly maxDepth?: number;
  readonly strategy?: SearchStrategy;
}

interface SearchNode {
  readonly board: Board;
  readonly parent: SearchNode | null;
  readonly move: Move | null;
  readonly depth: number;
  /** Depth-first only: moves still to try from this node. */
  pending?: Move[];
}

/**
 * A best-first frontier entry. It stores the move rather than the resulting
 * board, which is rebuilt when the entry is expanded: memory then grows with
 * the number of expanded positions instead of every generated one.
 */
interface FrontierEntry {
  readonly parent: SearchNode;
  readonly move: Move;
}

/** Evaluation points one extra move costs in best-first search. */
const DEPTH_PENALTY = 1;
/**
 * Upper bound on best-first frontier size per expanded node budget. It keeps
 * memory predictable on phones; hitting it ends the search as "unknown".
 */
const FRONTIER_PER_NODE = 12;

/** 53-bit string hash (cyrb53); keeps the transposition table compact. */
function hashKey(key: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < key.length; i += 1) {
    const ch = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Variant-agnostic solver with a transposition table.
 *
 * It relies only on the `Rules` API, so every variant — including the
 * original ones — gets deal verification, hints and auto-finish for free.
 * "Safe" automatic moves are forced, which collapses much of the search space.
 *
 * The search is incremental: `step()` expands a bounded number of positions
 * so the UI can spread the work over several frames and stay responsive.
 */
export class Solver {
  private readonly stack: SearchNode[] = [];
  private readonly queue = new MaxHeap<FrontierEntry>();
  private root: SearchNode | null;
  private readonly seen = new Set<number>();
  private readonly maxDepth: number;
  private readonly strategy: SearchStrategy;
  private nodes = 0;
  /** Set when a branch was cut by `maxDepth`, so exhaustion proves nothing. */
  private truncated = false;
  private outcome: SolveResult | null = null;

  public constructor(
    private readonly rules: Rules,
    start: Board,
    private readonly options: SolverOptions
  ) {
    this.maxDepth = options.maxDepth ?? 1000;
    this.strategy = options.strategy ?? "depth-first";
    this.seen.add(hashKey(rules.positionKey(start)));
    const root: SearchNode = { board: start, parent: null, move: null, depth: 0 };
    this.root = root;
    if (this.strategy === "depth-first") {
      this.stack.push(root);
    }
  }

  public get result(): SolveResult {
    return this.outcome ?? { status: "running", path: [], nodes: this.nodes };
  }

  public get done(): boolean {
    return this.outcome !== null;
  }

  /** Fraction of the node budget used so far (for progress bars). */
  public get effort(): number {
    return Math.min(1, this.nodes / this.options.maxNodes);
  }

  /** Expands up to `budget` positions. Returns true once the search is over. */
  public step(budget: number): boolean {
    const limit = this.nodes + budget;
    while (this.outcome === null && this.nodes < limit) {
      if (this.strategy === "depth-first") {
        this.stepDepthFirst();
      } else {
        this.stepBestFirst();
      }
    }
    return this.outcome !== null;
  }

  public run(): SolveResult {
    while (!this.step(10_000)) {
      // keep searching
    }
    return this.result;
  }

  /** Counts a newly reached node; returns false when the search just ended. */
  private visit(node: SearchNode): boolean {
    this.nodes += 1;
    if (this.rules.isWon(node.board)) {
      this.finish("solved", node);
      return false;
    }
    if (this.nodes >= this.options.maxNodes) {
      this.finish("unknown", null);
      return false;
    }
    if (node.depth >= this.maxDepth) {
      this.truncated = true;
      return false;
    }
    return true;
  }

  private stepDepthFirst(): void {
    const node = this.stack[this.stack.length - 1];
    if (node === undefined) {
      this.finish(this.truncated ? "unknown" : "unsolvable", null);
      return;
    }
    if (node.pending === undefined) {
      if (!this.visit(node)) {
        this.stack.pop();
        return;
      }
      node.pending = this.orderedMoves(node.board).reverse();
    }
    const move = node.pending.pop();
    if (move === undefined) {
      this.stack.pop();
      return;
    }
    const child = this.child(node, move);
    if (child) {
      this.stack.push(child);
    }
  }

  private stepBestFirst(): void {
    const node = this.nextBestNode();
    if (node === null) {
      this.finish(this.truncated ? "unknown" : "unsolvable", null);
      return;
    }
    if (!this.visit(node)) {
      return;
    }
    for (const move of this.forcedOrAll(node.board)) {
      const child = this.child(node, move);
      if (child) {
        this.queue.push({ parent: node, move }, this.rules.evaluate(child.board) - child.depth * DEPTH_PENALTY);
      }
    }
    if (this.queue.size > this.options.maxNodes * FRONTIER_PER_NODE) {
      this.finish("unknown", null);
    }
  }

  private nextBestNode(): SearchNode | null {
    if (this.root) {
      const root = this.root;
      this.root = null;
      return root;
    }
    const entry = this.queue.pop();
    if (entry === undefined) {
      return null;
    }
    const { parent, move } = entry;
    return { board: this.rules.apply(parent.board, move), parent, move, depth: parent.depth + 1 };
  }

  /** Applies a move; returns the child unless its position was seen before. */
  private child(parent: SearchNode, move: Move): SearchNode | null {
    const board = this.rules.apply(parent.board, move);
    const key = hashKey(this.rules.positionKey(board));
    if (this.seen.has(key)) {
      return null;
    }
    this.seen.add(key);
    return { board, parent, move, depth: parent.depth + 1 };
  }

  private forcedOrAll(board: Board): Move[] {
    const forced = this.rules.safeAutoMove(board);
    return forced ? [forced] : this.rules.usefulMoves(board);
  }

  private orderedMoves(board: Board): Move[] {
    const moves = this.forcedOrAll(board);
    if (moves.length < 2) {
      return moves;
    }
    return moves
      .map((move) => ({ move, score: this.rules.moveHeuristic(board, move) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.move);
  }

  private finish(status: SolveStatus, node: SearchNode | null): void {
    const path: Move[] = [];
    for (let current = node; current?.move; current = current.parent) {
      path.push(current.move);
    }
    this.outcome = { status, path: path.reverse(), nodes: this.nodes };
  }
}

export const solve = (rules: Rules, board: Board, options: SolverOptions): SolveResult =>
  new Solver(rules, board, options).run();
