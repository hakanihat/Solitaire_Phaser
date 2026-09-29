/**
 * Builds the lists of pre-verified winnable deals shipped with the game.
 *
 *   npm run deals -- <variant> [--count 100] [--minutes 20] [--difficulty easy]
 *
 * For each difficulty it walks through seeds, solves each deal, applies the
 * variant's effort filter, replays the solution through the rules as an
 * independent check, and writes `src/data/deals/<variant>.json`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeMoves, type Move } from "../src/core/moves";
import { DIFFICULTIES, type Difficulty, type Rules } from "../src/core/Rules";
import { solve } from "../src/core/solver";
import type { VariantDefinition } from "../src/core/variant";
import { getVariant } from "../src/variants";
import type { DealList } from "../src/services/deals";

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../src/data/deals");
/** Seeds for each difficulty come from separate ranges so lists never overlap. */
const SEED_BASE: Record<Difficulty, number> = { easy: 1_000_000, medium: 2_000_000, hard: 3_000_000 };

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

/** Independent check: every move must be legal and the final position won. */
function replays(rules: Rules, seed: number, path: readonly Move[]): boolean {
  let board = rules.deal(seed);
  for (const move of path) {
    if (!rules.isLegal(board, move)) {
      return false;
    }
    board = rules.apply(board, move);
  }
  return rules.isWon(board);
}

function generate(
  variant: VariantDefinition,
  difficulty: Difficulty,
  count: number,
  minutes: number
): [number, string][] {
  const rules = variant.createRules(difficulty);
  const effort = variant.solver.effort?.[difficulty] ?? {};
  const deadline = Date.now() + minutes * 60_000;
  const deals: [number, string][] = [];
  const tally = { tried: 0, unsolved: 0, filtered: 0 };
  for (let seed = SEED_BASE[difficulty]; deals.length < count && Date.now() < deadline; seed += 1) {
    tally.tried += 1;
    const result = solve(rules, rules.deal(seed), {
      maxNodes: variant.solver.verifyNodes,
      strategy: variant.solver.strategy,
    });
    if (result.status !== "solved") {
      tally.unsolved += 1;
      continue;
    }
    if (result.nodes < (effort.minNodes ?? 0) || result.nodes > (effort.maxNodes ?? Infinity)) {
      tally.filtered += 1;
      continue;
    }
    if (!replays(rules, seed, result.path)) {
      throw new Error(`${variant.id}/${difficulty} seed ${seed}: solver produced an invalid line`);
    }
    deals.push([seed, encodeMoves(result.path)]);
  }
  console.log(
    `${variant.id}/${difficulty}: ${deals.length} deals (tried ${tally.tried}, unsolved ${tally.unsolved}, filtered ${tally.filtered})`
  );
  return deals;
}

function main(): void {
  const variant = getVariant(process.argv[2] ?? "");
  const count = Number(argument("count", "100"));
  const minutes = Number(argument("minutes", "20"));
  const only = argument("difficulty", "");
  const file = join(OUTPUT_DIR, `${variant.id}.json`);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const list: DealList = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as DealList) : {};
  const next: Record<string, unknown> = { ...list };
  for (const difficulty of DIFFICULTIES) {
    if (only === "" || only === difficulty) {
      next[difficulty] = generate(variant, difficulty, count, minutes);
      writeFileSync(file, `${JSON.stringify(next)}\n`);
    }
  }
}

main();
