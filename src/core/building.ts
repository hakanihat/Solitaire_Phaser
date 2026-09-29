import type { Board } from "./board";
import { ACE, type Card, KING } from "./cards";
import type { Rules } from "./Rules";

/**
 * A building relation answers "may `upper` be placed on `lower`?". Variants
 * compose these instead of re-implementing the classic rules each time.
 */
export type Relation = (lower: Card, upper: Card) => boolean;

export const alternateColorsDown: Relation = (lower, upper) => upper.rank === lower.rank - 1 && upper.red !== lower.red;

export const sameSuitDown: Relation = (lower, upper) => upper.rank === lower.rank - 1 && upper.suit === lower.suit;

export const anySuitDown: Relation = (lower, upper) => upper.rank === lower.rank - 1;

export const sameSuitUp: Relation = (lower, upper) => upper.rank === lower.rank + 1 && upper.suit === lower.suit;

/** Ranks one apart in either direction, optionally wrapping King ↔ Ace. */
export const adjacentRank = (a: number, b: number, wrap: boolean): boolean =>
  Math.abs(a - b) === 1 || (wrap && ((a === ACE && b === KING) || (a === KING && b === ACE)));

/** True when every card from `index` to the top follows `relation`. */
export function isRun(rules: Rules, board: Board, pile: number, index: number, relation: Relation): boolean {
  const cards = board.piles[pile];
  for (let i = index + 1; i < cards.length; i += 1) {
    if (!relation(rules.card(cards[i - 1]), rules.card(cards[i]))) {
      return false;
    }
  }
  return true;
}

/** Standard foundation: Ace on empty, then same suit ascending. */
export function canBuildFoundation(top: Card | undefined, card: Card): boolean {
  return top === undefined ? card.rank === ACE : sameSuitUp(top, card);
}

/**
 * Highest rank on the foundations for each suit (0 when not started). Used by
 * the "safe to auto-play" test shared by the Klondike family.
 */
export function foundationRanks(rules: Rules, board: Board, foundations: readonly number[]): number[] {
  const ranks = [0, 0, 0, 0];
  for (const pile of foundations) {
    const top = rules.topCard(board, pile);
    if (top) {
      ranks[top.suit] = Math.max(ranks[top.suit], top.rank);
    }
  }
  return ranks;
}

/**
 * A card may be sent to the foundation automatically when no card that could
 * still need it as a building base remains in play: in alternate-colour games,
 * that is when both opposite-colour suits have reached rank - 1.
 */
export function isSafeForAlternatingColors(card: Card, ranks: readonly number[]): boolean {
  if (card.rank <= 2) {
    return true;
  }
  const opposite = card.red ? [ranks[2], ranks[3]] : [ranks[0], ranks[1]];
  return opposite.every((rank) => rank >= card.rank - 1);
}
