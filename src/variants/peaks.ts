import type { Board } from "../core/board";
import { adjacentRank } from "../core/building";
import type { Card } from "../core/cards";
import { PileKind } from "../core/layout";
import { type Move, drawMove, transfer } from "../core/moves";
import { OverlapRules } from "./overlap";

/**
 * Shared rules for "build a chain on the waste" games (TriPeaks, Gemini):
 * any available card may be played onto a waste pile when it is one rank
 * above or below the waste's top card. Consecutive plays form a combo.
 */
export abstract class ChainRules extends OverlapRules {
  public override readonly comboScoring = true;
  /** Only the top card of a waste can ever be built on again. */
  protected override readonly topOnlyKinds = [PileKind.Foundation, PileKind.Waste];

  protected abstract readonly wrap: boolean;

  protected get stock(): number {
    return this.pilesOf(PileKind.Stock)[0];
  }

  protected get wastes(): readonly number[] {
    return this.pilesOf(PileKind.Waste);
  }

  public canPick(board: Board, pile: number, index: number): boolean {
    return (
      this.kindOf(pile) === PileKind.Slot && index === board.piles[pile].length - 1 && this.isAvailable(board, pile)
    );
  }

  public canDrop(board: Board, from: number, index: number, to: number): boolean {
    if (this.kindOf(to) !== PileKind.Waste) {
      return false;
    }
    const top = this.topCard(board, to);
    return top !== undefined && this.chains(top, this.cardAt(board, from, index));
  }

  protected chains(top: Card, card: Card): boolean {
    return adjacentRank(top.rank, card.rank, this.wrap);
  }

  public override canDraw(board: Board): boolean {
    return board.piles[this.stock].length > 0;
  }

  /** Cleared cards are progress; unused stock cards are a resource. */
  public override evaluate(board: Board): number {
    return super.evaluate(board) + board.piles[this.stock].length * 8;
  }

  public override usefulMoves(board: Board): Move[] {
    const moves: Move[] = [];
    for (const slot of this.slots) {
      if (!this.canPick(board, slot, board.piles[slot].length - 1)) {
        continue;
      }
      for (const waste of this.wastes) {
        if (this.canDrop(board, slot, 0, waste)) {
          moves.push(transfer(slot, waste));
        }
      }
    }
    if (this.canDraw(board)) {
      moves.push(drawMove);
    }
    return moves;
  }

  /** Favour plays that uncover face-down cards and keep long chains going. */
  public override moveHeuristic(board: Board, move: Move): number {
    if (move.kind !== "move") {
      return 0;
    }
    const after = this.apply(board, move);
    const revealed = board.hidden.reduce((sum, hidden, pile) => sum + hidden - after.hidden[pile], 0);
    const followUps = this.usefulMoves(after).filter((next) => next.kind === "move").length;
    return 20 + revealed * 15 + followUps * 5;
  }
}
