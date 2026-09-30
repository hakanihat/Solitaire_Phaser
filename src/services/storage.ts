import type { Difficulty } from "../core/Rules";

export interface Settings {
  sound: boolean;
  /** Tap a card to send it to its best destination. */
  tapToMove: boolean;
  /** Automatically play cards to the foundation when it can't hurt. */
  autoFoundation: boolean;
  leftHanded: boolean;
  showTimer: boolean;
  /** Short vibrations on moves (touch devices). */
  vibration: boolean;
  /** Grey out face-up cards that can't be played right now. */
  dimLocked: boolean;
}

export interface Stats {
  played: number;
  won: number;
  streak: number;
  bestStreak: number;
  bestTime: number | null;
  bestScore: number;
  fewestMoves: number | null;
}

/** A game in progress, stored so it survives the app being closed. */
export interface SavedGame {
  readonly variant: string;
  readonly difficulty: Difficulty;
  readonly seed: number;
  /** Encoded move list (see `encodeMoves`). */
  readonly moves: string;
  readonly elapsed: number;
  /** Encoded known winning line from the start, if the deal shipped one. */
  readonly solution?: string;
}

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  tapToMove: true,
  autoFoundation: true,
  leftHanded: false,
  showTimer: true,
  vibration: true,
  dimLocked: true,
};

const EMPTY_STATS: Stats = {
  played: 0,
  won: 0,
  streak: 0,
  bestStreak: 0,
  bestTime: null,
  bestScore: 0,
  fewestMoves: null,
};

const PREFIX = "solitaire.v2.";

/**
 * Thin, fault-tolerant wrapper around localStorage (which Capacitor's WebView
 * persists). Storage can be unavailable or full; the game must keep working,
 * so every access falls back to defaults.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

function readRaw<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: progress simply isn't persisted.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

const statsKey = (variant: string, difficulty: Difficulty): string => `stats.${variant}.${difficulty}`;

export const storage = {
  settings(): Settings {
    return read("settings", DEFAULT_SETTINGS);
  },

  updateSettings(changes: Partial<Settings>): Settings {
    const next = { ...this.settings(), ...changes };
    write("settings", next);
    return next;
  },

  stats(variant: string, difficulty: Difficulty): Stats {
    return read(statsKey(variant, difficulty), EMPTY_STATS);
  },

  /** Total wins across all difficulties, shown on menu tiles. */
  totalWins(variant: string): number {
    return (["easy", "medium", "hard"] as const).reduce((sum, d) => sum + this.stats(variant, d).won, 0);
  },

  recordStart(variant: string, difficulty: Difficulty): void {
    const stats = this.stats(variant, difficulty);
    write(statsKey(variant, difficulty), { ...stats, played: stats.played + 1 });
  },

  /** Records a finished game and returns the updated stats plus which records were beaten. */
  recordWin(
    variant: string,
    difficulty: Difficulty,
    result: { time: number; score: number; moves: number }
  ): { stats: Stats; newBestTime: boolean; newBestScore: boolean } {
    const old = this.stats(variant, difficulty);
    const newBestTime = old.bestTime === null || result.time < old.bestTime;
    const newBestScore = result.score > old.bestScore;
    const streak = old.streak + 1;
    const stats: Stats = {
      ...old,
      won: old.won + 1,
      streak,
      bestStreak: Math.max(old.bestStreak, streak),
      bestTime: newBestTime ? result.time : old.bestTime,
      bestScore: Math.max(old.bestScore, result.score),
      fewestMoves: old.fewestMoves === null ? result.moves : Math.min(old.fewestMoves, result.moves),
    };
    write(statsKey(variant, difficulty), stats);
    return { stats, newBestTime, newBestScore };
  },

  /** Abandoning a started game breaks the win streak. */
  recordAbandon(variant: string, difficulty: Difficulty): void {
    const stats = this.stats(variant, difficulty);
    write(statsKey(variant, difficulty), { ...stats, streak: 0 });
  },

  lastDifficulty(variant: string): Difficulty {
    return readRaw<Difficulty>(`difficulty.${variant}`) ?? "easy";
  },

  setLastDifficulty(variant: string, difficulty: Difficulty): void {
    write(`difficulty.${variant}`, difficulty);
  },

  tutorialSeen(variant: string): boolean {
    return readRaw<boolean>(`tutorial.${variant}`) === true;
  },

  markTutorialSeen(variant: string): void {
    write(`tutorial.${variant}`, true);
  },

  savedGame(): SavedGame | null {
    return readRaw<SavedGame>("save");
  },

  saveGame(game: SavedGame): void {
    write("save", game);
  },

  clearSavedGame(): void {
    remove("save");
  },

  /** How many deals of a list this player has started (to rotate through them). */
  dealCursor(variant: string, difficulty: Difficulty): number {
    return readRaw<number>(`cursor.${variant}.${difficulty}`) ?? 0;
  },

  advanceDealCursor(variant: string, difficulty: Difficulty): void {
    write(`cursor.${variant}.${difficulty}`, this.dealCursor(variant, difficulty) + 1);
  },

  /** A random number fixed per install, so each player gets their own deal order. */
  installSalt(): number {
    const existing = readRaw<number>("salt");
    if (existing !== null) {
      return existing;
    }
    const salt = Math.floor(Math.random() * 2 ** 31);
    write("salt", salt);
    return salt;
  },
};
