import { CARD_DIMENSIONS } from "./deck";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./screen";

/**
 * Define the constants for the table.
 */
export enum PileId {
  Discard = "Discard",
  Stock = "Stock",
  Tableau1 = "Tableau 1",
  Tableau2 = "Tableau 2",
  Tableau3 = "Tableau 3",
  Tableau4 = "Tableau 4",
  Tableau5 = "Tableau 5",
  Tableau6 = "Tableau 6",
  Tableau7 = "Tableau 7",
  Foundation1 = "Foundation 1",
  Foundation2 = "Foundation 2",
  Foundation3 = "Foundation 3",
  Foundation4 = "Foundation 4",
  None = "NONE",
}

/**
 * Define tableau piles
 */
export const TABLEAU_PILES = [
  PileId.Tableau1,
  PileId.Tableau2,
  PileId.Tableau3,
  PileId.Tableau4,
  PileId.Tableau5,
  PileId.Tableau6,
  PileId.Tableau7,
];

/**
 * Define foundation piles
 */
export const FOUNDATION_PILES = [
  PileId.Foundation1,
  PileId.Foundation2,
  PileId.Foundation3,
  PileId.Foundation4,
];


export const ALL_PILES = [
  PileId.Foundation1,
  PileId.Foundation2,
  PileId.Foundation3,
  PileId.Foundation4,
  PileId.Tableau1,
  PileId.Tableau2,
  PileId.Tableau3,
  PileId.Tableau4,
  PileId.Tableau5,
  PileId.Tableau6,
  PileId.Tableau7,

];

export const TOTAL_PILES = [
  PileId.Stock,
  PileId.Discard,
  PileId.Foundation1,
  PileId.Foundation2,
  PileId.Foundation3,
  PileId.Foundation4,
  PileId.Tableau1,
  PileId.Tableau2,
  PileId.Tableau3,
  PileId.Tableau4,
  PileId.Tableau5,
  PileId.Tableau6,
  PileId.Tableau7,

];
/**
 * Offsets for card positions
 */
const PILE_OFFSET = CARD_DIMENSIONS.width + 10;

/**
 * Positions of piles on screen
 */


// height: (screen.height * devicePixelRatio)/9.6,
//   width: (screen.width * devicePixelRatio) /7.2,
export const PILE_POSITIONS_LEFT: Record<PileId, Phaser.Math.Vector2> = {
  [PileId.Stock]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82, SCREEN_HEIGHT/7.74),
  [PileId.Discard]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + PILE_OFFSET + 30, SCREEN_HEIGHT/7.74),

  [PileId.Foundation1]: new Phaser.Math.Vector2(SCREEN_WIDTH /1.96, SCREEN_HEIGHT/7.74),
  [PileId.Foundation2]: new Phaser.Math.Vector2(SCREEN_WIDTH /1.96 + PILE_OFFSET+5, SCREEN_HEIGHT/7.74),
  [PileId.Foundation3]: new Phaser.Math.Vector2(SCREEN_WIDTH /1.96 + 2 * PILE_OFFSET+10, SCREEN_HEIGHT/7.74),
  [PileId.Foundation4]: new Phaser.Math.Vector2(SCREEN_WIDTH /1.96 + 3 * PILE_OFFSET+15, SCREEN_HEIGHT/7.74),

  [PileId.Tableau1]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82, SCREEN_HEIGHT/3.81),
  [PileId.Tableau2]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + PILE_OFFSET, SCREEN_HEIGHT/3.81),
  [PileId.Tableau3]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + 2 * PILE_OFFSET,SCREEN_HEIGHT/3.81),
  [PileId.Tableau4]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + 3 * PILE_OFFSET, SCREEN_HEIGHT/3.81),
  [PileId.Tableau5]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + 4 * PILE_OFFSET, SCREEN_HEIGHT/3.81),
  [PileId.Tableau6]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82+ 5 * PILE_OFFSET, SCREEN_HEIGHT/3.81),
  [PileId.Tableau7]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82+ 6 * PILE_OFFSET, SCREEN_HEIGHT/3.81),

  [PileId.None]: new Phaser.Math.Vector2(0, 0),
};

export const PILE_POSITIONS_RIGHT: Record<PileId, Phaser.Math.Vector2> = {
  [PileId.Stock]: new Phaser.Math.Vector2(SCREEN_WIDTH /1.08 +50, SCREEN_HEIGHT/7.74),
  [PileId.Discard]: new Phaser.Math.Vector2(SCREEN_WIDTH /1.08 - PILE_OFFSET + 30, SCREEN_HEIGHT/7.74),

  [PileId.Foundation1]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + 3 * PILE_OFFSET+15, SCREEN_HEIGHT/7.74),
  [PileId.Foundation2]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + 2 * PILE_OFFSET+10, SCREEN_HEIGHT/7.74),
  [PileId.Foundation3]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + PILE_OFFSET+5, SCREEN_HEIGHT/7.74),
  [PileId.Foundation4]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 , SCREEN_HEIGHT/7.74),

  [PileId.Tableau1]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82+ 6 * PILE_OFFSET, SCREEN_HEIGHT/3.81),
  [PileId.Tableau2]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82+ 5 * PILE_OFFSET, SCREEN_HEIGHT/3.81),
  [PileId.Tableau3]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + 4 * PILE_OFFSET, SCREEN_HEIGHT/3.81),
  [PileId.Tableau4]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + 3 * PILE_OFFSET, SCREEN_HEIGHT/3.81),
  [PileId.Tableau5]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + 2 * PILE_OFFSET, SCREEN_HEIGHT/3.81),
  [PileId.Tableau6]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82 + PILE_OFFSET, SCREEN_HEIGHT/3.81),
  [PileId.Tableau7]: new Phaser.Math.Vector2(SCREEN_WIDTH /9.82,  SCREEN_HEIGHT/3.81),

  [PileId.None]: new Phaser.Math.Vector2(0, 0),
};


export function getCurrentPositions(isLeftHanded: boolean): Record<PileId, Phaser.Math.Vector2> {
  if (isLeftHanded) {
    console.log('Using left-handed positions');
    return PILE_POSITIONS_LEFT;
  } else {
    console.log('Using right-handed positions');
    return PILE_POSITIONS_RIGHT;
  }
}
