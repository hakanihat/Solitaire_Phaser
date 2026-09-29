import type { Move } from "../core/moves";
import type { Difficulty } from "../core/Rules";

export const SceneKey = {
  Boot: "boot",
  Menu: "menu",
  Loading: "loading",
  Game: "game",
} as const;

/** What the loading screen needs to prepare a game. */
export interface LoadingData {
  readonly variant: string;
  readonly difficulty: Difficulty;
  /** Resume this saved game instead of dealing a new one. */
  readonly resume?: boolean;
}

/** Everything the game scene needs to start playing. */
export interface GameData {
  readonly variant: string;
  readonly difficulty: Difficulty;
  readonly seed: number;
  /** A verified winning line from the deal's start position, if known. */
  readonly solution: readonly Move[] | null;
  /** Moves to replay when resuming a saved game. */
  readonly replay?: readonly Move[];
  readonly elapsed?: number;
}

/** Generated particle textures. */
export const FX = {
  dot: "fx_dot",
  spark: "fx_spark",
  confetti: "fx_confetti",
  /** The four suits as frames 0–3, for celebratory particles. */
  suits: "fx_suits",
} as const;
