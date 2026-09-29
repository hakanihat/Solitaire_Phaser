/**
 * Suits are numbered in the same order as the rows of the card sprite sheet,
 * so `suit` doubles as the sprite row index.
 */
export enum Suit {
  Hearts = 0,
  Diamonds = 1,
  Clubs = 2,
  Spades = 3,
}

export const ALL_SUITS: readonly Suit[] = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];

export const ACE = 1;
export const JACK = 11;
export const QUEEN = 12;
export const KING = 13;
export const RANKS_PER_SUIT = 13;

export interface Card {
  /** Unique within a deal; also the index into the deal's card table. */
  readonly id: number;
  readonly suit: Suit;
  /** 1 (Ace) .. 13 (King). */
  readonly rank: number;
  readonly red: boolean;
}

export const isRed = (suit: Suit): boolean => suit === Suit.Hearts || suit === Suit.Diamonds;

/**
 * Builds a card table of `count` cards. Suits cycle through `suits`, which lets
 * Spider build a 104-card one- or two-suit pack from the same function.
 */
export function createCards(count: number, suits: readonly Suit[] = ALL_SUITS): Card[] {
  const cards: Card[] = [];
  const suitRuns = count / RANKS_PER_SUIT;
  for (let run = 0; run < suitRuns; run += 1) {
    const suit = suits[run % suits.length];
    for (let rank = ACE; rank <= KING; rank += 1) {
      cards.push({ id: cards.length, suit, rank, red: isRed(suit) });
    }
  }
  return cards;
}

const RANK_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT_SYMBOLS = ["♥", "♦", "♣", "♠"];

export const rankLabel = (rank: number): string => RANK_LABELS[rank];
export const suitSymbol = (suit: Suit): string => SUIT_SYMBOLS[suit];
export const cardLabel = (card: Card): string => `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
