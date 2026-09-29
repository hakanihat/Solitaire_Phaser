import type { Board } from "./board";
import { PileKind } from "./layout";
import { type Move, sameMove } from "./moves";
import type { Rules } from "./Rules";

/** Every move that picking up `pile` from `index` could turn into. */
export function movesFrom(rules: Rules, board: Board, pile: number, index: number): Move[] {
  const moves: Move[] = [];
  for (let to = 0; to < board.piles.length; to += 1) {
    const move = rules.resolveDrop(board, pile, index, to);
    if (move) {
      moves.push(move);
    }
  }
  return moves;
}

/** Where a tapped card most naturally goes: home first, empty columns last. */
function destinationRank(rules: Rules, board: Board, move: Move): number {
  if (move.kind !== "move") {
    return 3;
  }
  switch (rules.kindOf(move.to)) {
    case PileKind.Foundation:
      return 4;
    case PileKind.Waste:
      return 3;
    case PileKind.Tableau:
      return board.piles[move.to].length > 0 ? 2 : 0;
    case PileKind.Cell:
      return 1;
    default:
      return 0;
  }
}

/**
 * Chooses the move for a tap on a card. When the hint engine knows a winning
 * line and its next move starts from this card, that move wins; otherwise
 * destinations are ranked and ties broken by the variant's heuristic.
 */
export function chooseTapMove(rules: Rules, board: Board, pile: number, index: number, preferred?: Move): Move | null {
  const candidates = movesFrom(rules, board, pile, index);
  if (preferred && candidates.some((move) => sameMove(move, preferred))) {
    return preferred;
  }
  const ranked = candidates
    .map((move) => ({ move, rank: destinationRank(rules, board, move), score: rules.moveHeuristic(board, move) }))
    .sort((a, b) => b.rank - a.rank || b.score - a.score);
  return ranked[0]?.move ?? null;
}
