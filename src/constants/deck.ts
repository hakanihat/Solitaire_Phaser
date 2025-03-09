import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./screen";

/**
 * Suits
 */
export enum Suit {
  Clubs = "Clubs",
  Diamonds = "Diamonds",
  Hearts = "Hearts",
  Spades = "Spades",
}

/**
 * Color map
 */
export enum SuitColor {
  Red = "Red",
  Black = "Black",
}

/**
 * Defines sprite offset of each suit in the spritemap.
 */
export const SUIT_IMAGE_INDEX = {
  [Suit.Hearts]: 0,
  [Suit.Diamonds]: 1,
  [Suit.Clubs]: 2,
  [Suit.Spades]: 3,
} as const;

/**
 * Defines suit colors
 */
export const SUIT_COLOR = {
  [Suit.Hearts]: SuitColor.Red,
  [Suit.Diamonds]: SuitColor.Red,
  [Suit.Clubs]: SuitColor.Black,
  [Suit.Spades]: SuitColor.Black,
} as const;

/**
 * Deck dimensions
 */
export const CARD_DIMENSIONS = {
  height: SCREEN_HEIGHT/9.6,
  width: SCREEN_WIDTH /7.2,
};


export const toggleSwitchConfig = {
  click: {
      mode: 0, // or 'pointerdown'
      clickInterval: 200, // ms
      threshold: 5, // You can adjust this value based on your preference
  },
};

export const NUM_CARDS = 52;
export const NUM_SUITS = 4;
export const NUM_VALUES = 13;

export const SPRITE_CARD_WIDTH = 14;//14;
export const CARD_BACK_INDEX = 27;
export const STACK_OFFSET = SCREEN_HEIGHT/30;
export const STACK_DRAG_OFFSET = SCREEN_HEIGHT/24;
