import { decodeMoves, type Move } from "../core/moves";
import { createRng, shuffle } from "../core/random";
import type { Difficulty } from "../core/Rules";
import { storage } from "./storage";

/** A deal is its seed plus, when known, a verified winning line. */
export interface Deal {
  readonly seed: number;
  readonly solution: readonly Move[] | null;
}

/** Shape of `src/data/deals/<variant>.json`: seed + encoded solution per deal. */
export type DealList = Partial<Record<Difficulty, readonly (readonly [number, string])[]>>;

// Each variant's list becomes its own chunk, fetched only when that game is
// opened — the loading screen is where this download happens.
const loaders = import.meta.glob<DealList>("../data/deals/*.json", { import: "default" });

export async function loadDealList(variant: string): Promise<DealList | null> {
  const loader = loaders[`../data/deals/${variant}.json`];
  if (!loader) {
    return null;
  }
  try {
    return await loader();
  } catch {
    return null;
  }
}

const hashString = (text: string): number =>
  [...text].reduce((hash, ch) => Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

/**
 * Picks the player's next deal from a pre-verified list. Every install walks
 * the list in its own shuffled order, so friends don't all get the same games.
 */
export function nextDeal(list: DealList | null, variant: string, difficulty: Difficulty): Deal | null {
  const entries = list?.[difficulty] ?? [];
  if (entries.length === 0) {
    return null;
  }
  const order = shuffle(
    entries.map((_, i) => i),
    createRng(storage.installSalt() ^ hashString(`${variant}/${difficulty}`))
  );
  const [seed, solution] = entries[order[storage.dealCursor(variant, difficulty) % entries.length]];
  storage.advanceDealCursor(variant, difficulty);
  return { seed, solution: decodeMoves(solution) };
}
