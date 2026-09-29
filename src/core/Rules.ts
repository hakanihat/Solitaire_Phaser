import { type Board, type KeyOptions, boardKey, cloneBoard, isTopFaceUp, revealTop, transferCards } from "./board";
import { type Card, cardLabel } from "./cards";
import { type Layout, PileKind } from "./layout";
import { type Move, drawMove, transfer } from "./moves";
import { createRng, shuffle } from "./random";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

/**
 * The contract every solitaire variant implements.
 *
 * A `Rules` instance is created for one variant + difficulty. It is stateless:
 * all game state lives in `Board`s, which makes rules trivially shareable
 * between the renderer, the hint AI and the offline deal generator.
 *
 * Subclasses answer a few rule questions (`canPick`, `canDrop`, `deal`, …)
 * and inherit generic move generation, move application, scoring hooks and
 * human-readable move descriptions.
 */
export abstract class Rules {
  public readonly cards: readonly Card[];
  public readonly layout: Layout;
  /**
   * Groups of piles that are interchangeable under the rules. The solver uses
   * them to recognise permuted copies of a position it has already explored.
   */
  public readonly symmetricGroups: readonly (readonly number[])[] = [];
  /** Peaks-style games reward uninterrupted chains of plays with a multiplier. */
  public readonly comboScoring: boolean = false;
  /**
   * Whether the number of stock passes is part of the position. Only true for
   * variants with a limited number of redeals; otherwise recycling the waste
   * would make an endless stream of "new" positions for the solver.
   */
  protected readonly passesMatter: boolean = false;

  private readonly pilesByKind = new Map<PileKind, number[]>();

  protected constructor(cards: readonly Card[], layout: Layout) {
    this.cards = cards;
    this.layout = layout;
    layout.piles.forEach((pile, index) => {
      const list = this.pilesByKind.get(pile.kind) ?? [];
      list.push(index);
      this.pilesByKind.set(pile.kind, list);
    });
  }

  // ---------------------------------------------------------------------------
  // Rule questions answered by each variant
  // ---------------------------------------------------------------------------

  /** Creates the initial board for a seed. Must be deterministic. */
  public abstract deal(seed: number): Board;

  /** May the player pick up the cards of `pile` from `index` to the top? */
  public abstract canPick(board: Board, pile: number, index: number): boolean;

  /** May the cards of `from` starting at `index` be placed onto `to`? */
  public abstract canDrop(board: Board, from: number, index: number, to: number): boolean;

  /** Whether tapping the stock currently does anything. */
  public canDraw(_board: Board): boolean {
    return false;
  }

  /** Performs the stock action on a board clone. */
  protected performDraw(_board: Board): void {
    // Variants without a stock never get here.
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  public pilesOf(kind: PileKind): readonly number[] {
    return this.pilesByKind.get(kind) ?? [];
  }

  public kindOf(pile: number): PileKind {
    return this.layout.piles[pile].kind;
  }

  public card(id: number): Card {
    return this.cards[id];
  }

  public topCard(board: Board, pile: number): Card | undefined {
    const cards = board.piles[pile];
    return cards.length > 0 ? this.cards[cards[cards.length - 1]] : undefined;
  }

  public cardAt(board: Board, pile: number, index: number): Card {
    return this.cards[board.piles[pile][index]];
  }

  /** Number of cards that count as "done" (usually cards on foundations). */
  public progress(board: Board): number {
    return this.pilesOf(PileKind.Foundation).reduce((sum, pile) => sum + board.piles[pile].length, 0);
  }

  /** Progress value at which the game is won. */
  public goal(): number {
    return this.cards.length;
  }

  public isWon(board: Board): boolean {
    return this.progress(board) >= this.goal();
  }

  /**
   * True when nothing is left to discover, so the solver can reliably finish
   * the game for the player ("Auto finish").
   */
  public canAutoFinish(board: Board): boolean {
    return board.hidden.every((hidden) => hidden === 0);
  }

  /**
   * A move that is always safe to make automatically (it can never hurt the
   * player's chances). Used by "auto-play to foundation" and to prune the
   * solver's search. Variants opt in by overriding.
   */
  public safeAutoMove(_board: Board): Move | null {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Move generation & application
  // ---------------------------------------------------------------------------

  /**
   * Pile kinds whose contents below the top card can never matter again.
   * Foundations are built in a fixed order, so their top card identifies them.
   */
  protected readonly topOnlyKinds: readonly PileKind[] = [PileKind.Foundation];

  private keyOptions?: KeyOptions;

  /** Identity of a position for transposition tables and repetition checks. */
  public positionKey(board: Board): string {
    this.keyOptions ??= {
      symmetricGroups: this.symmetricGroups,
      includePasses: this.passesMatter,
      topOnly: this.layout.piles.map((pile) => this.topOnlyKinds.includes(pile.kind)),
    };
    return boardKey(board, this.keyOptions);
  }

  /**
   * Legal moves worth considering from a position (moves that can never help,
   * such as shuttling a whole column into another empty column, are filtered
   * out). Used by the solver and the hint AI.
   */
  public usefulMoves(board: Board): Move[] {
    const moves: Move[] = [];
    const pileCount = board.piles.length;
    for (let from = 0; from < pileCount; from += 1) {
      const length = board.piles[from].length;
      // Pick-up validity is monotonic: if a run starting at `index` is
      // movable, every shorter run on top of it is too. Scan downwards.
      for (let index = length - 1; index >= board.hidden[from]; index -= 1) {
        if (!this.canPick(board, from, index)) {
          break;
        }
        for (let to = 0; to < pileCount; to += 1) {
          if (to !== from && this.canDrop(board, from, index, to) && !this.isPointless(board, from, index, to)) {
            moves.push(transfer(from, to, length - index));
          }
        }
      }
    }
    if (this.canDraw(board)) {
      moves.push(drawMove);
    }
    return moves;
  }

  public isLegal(board: Board, move: Move): boolean {
    switch (move.kind) {
      case "draw":
        return this.canDraw(board);
      case "pair":
        return this.canPair(board, move.a, move.b);
      case "move": {
        const index = board.piles[move.from].length - move.count;
        return (
          index >= board.hidden[move.from] &&
          this.canPick(board, move.from, index) &&
          this.canDrop(board, move.from, index, move.to)
        );
      }
    }
  }

  /** Returns a new board with the move applied (the input is never mutated). */
  public apply(board: Board, move: Move): Board {
    const next = cloneBoard(board);
    switch (move.kind) {
      case "draw":
        this.performDraw(next);
        break;
      case "pair":
        this.performPair(next, move.a, move.b);
        break;
      case "move":
        transferCards(next, move.from, move.to, move.count);
        break;
    }
    this.afterMove(next, move);
    return next;
  }

  /**
   * Converts a drag-and-drop gesture into a move. Most variants just move the
   * picked cards; Pyramid overrides this to turn "card onto card" into a pair.
   */
  public resolveDrop(board: Board, from: number, index: number, to: number): Move | null {
    if (from === to || !this.canPick(board, from, index)) {
      return null;
    }
    return this.canDrop(board, from, index, to) ? transfer(from, to, board.piles[from].length - index) : null;
  }

  /**
   * How promising a position looks (higher is better). Drives best-first
   * search. The default rewards progress and uncovered cards and values free
   * space; variants add knowledge such as how deeply key cards are buried.
   */
  public evaluate(board: Board): number {
    let hidden = 0;
    let free = 0;
    board.piles.forEach((cards, pile) => {
      const kind = this.kindOf(pile);
      if (kind === PileKind.Tableau || kind === PileKind.Slot) {
        hidden += board.hidden[pile];
      }
      if (cards.length === 0 && (kind === PileKind.Tableau || kind === PileKind.Cell)) {
        free += 1;
      }
    });
    return this.progress(board) * 20 - hidden * 8 + free * 4;
  }

  /**
   * Total number of cards lying on top of the cards for which `isNeeded` is
   * true. Keeping the next foundation cards shallow is the single most useful
   * signal for foundation-building games.
   */
  protected buriedDepth(board: Board, isNeeded: (card: Card) => boolean): number {
    let depth = 0;
    board.piles.forEach((cards, pile) => {
      const kind = this.kindOf(pile);
      if (kind !== PileKind.Tableau && kind !== PileKind.Cell && kind !== PileKind.Waste) {
        return;
      }
      cards.forEach((id, index) => {
        if (isNeeded(this.cards[id])) {
          depth += cards.length - 1 - index;
        }
      });
    });
    return depth;
  }

  /** Rule-of-thumb value of a move; higher is tried first by the solver. */
  public moveHeuristic(board: Board, move: Move): number {
    if (move.kind === "draw") {
      return 0;
    }
    if (move.kind === "pair") {
      return 50;
    }
    const toKind = this.kindOf(move.to);
    const fromKind = this.kindOf(move.from);
    const remaining = board.piles[move.from].length - move.count;
    let score = 0;
    if (toKind === PileKind.Foundation) {
      score += 100;
    }
    if (remaining > 0 && remaining <= board.hidden[move.from]) {
      score += 60; // reveals a face-down card
    }
    if (remaining === 0 && fromKind === PileKind.Tableau) {
      score += 25; // empties a column
    }
    if (fromKind === PileKind.Waste || fromKind === PileKind.Cell) {
      score += 15;
    }
    if (toKind === PileKind.Cell) {
      score -= 30;
    }
    if (toKind === PileKind.Tableau && board.piles[move.to].length === 0) {
      score -= 20;
    }
    if (fromKind === PileKind.Foundation) {
      score -= 60;
    }
    return score + move.count;
  }

  public describeMove(board: Board, move: Move): string {
    switch (move.kind) {
      case "draw":
        return this.describeDraw(board);
      case "pair": {
        const a = this.topCard(board, move.a);
        const b = this.topCard(board, move.b);
        return a && b ? `Pair ${cardLabel(a)} with ${cardLabel(b)}` : "Pair two cards";
      }
      case "move": {
        const first = this.cardAt(board, move.from, board.piles[move.from].length - move.count);
        const what =
          move.count > 1
            ? `${cardLabel(first)} and the ${move.count - 1} card${move.count > 2 ? "s" : ""} on it`
            : cardLabel(first);
        return `Move ${what} ${this.describeTarget(board, move.to)}`;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Hooks and helpers for subclasses
  // ---------------------------------------------------------------------------

  protected canPair(_board: Board, _a: number, _b: number): boolean {
    return false;
  }

  protected performPair(_board: Board, _a: number, _b: number): void {
    // Only Pyramid-style variants use pairs.
  }

  /** Runs after every move. Default: turn over exposed tableau cards. */
  protected afterMove(board: Board, _move: Move): void {
    for (const pile of this.pilesOf(PileKind.Tableau)) {
      revealTop(board, pile);
    }
  }

  /** Filters legal-but-useless moves so neither the solver nor hints waste time on them. */
  protected isPointless(board: Board, from: number, index: number, to: number): boolean {
    // Moving a whole pile onto an empty pile of the same kind changes nothing.
    return (
      index === 0 && board.hidden[from] === 0 && board.piles[to].length === 0 && this.kindOf(from) === this.kindOf(to)
    );
  }

  protected describeDraw(board: Board): string {
    const stock = this.pilesOf(PileKind.Stock)[0];
    return stock !== undefined && board.piles[stock].length === 0
      ? "Turn the waste pile back over"
      : "Draw from the stock";
  }

  protected describeTarget(board: Board, to: number): string {
    const kind = this.kindOf(to);
    const top = this.topCard(board, to);
    switch (kind) {
      case PileKind.Foundation:
        return "to the foundation";
      case PileKind.Cell:
        return "to a free cell";
      case PileKind.Waste:
        return top ? `onto ${cardLabel(top)}` : "to the waste";
      default:
        return top && isTopFaceUp(board, to) ? `onto ${cardLabel(top)}` : "to the empty column";
    }
  }

  /** Deterministically shuffled card ids for a seed. */
  protected shuffledIds(seed: number): number[] {
    return shuffle(
      this.cards.map((card) => card.id),
      createRng(seed)
    );
  }
}
