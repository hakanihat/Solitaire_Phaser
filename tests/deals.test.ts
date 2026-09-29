import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeMoves } from "../src/core/moves";
import { DIFFICULTIES } from "../src/core/Rules";
import type { DealList } from "../src/services/deals";
import { getVariant, VARIANTS } from "../src/variants";

const DEALS_DIR = join(__dirname, "../src/data/deals");
const files = readdirSync(DEALS_DIR).filter((file) => file.endsWith(".json"));

/*
 * The collection promises that every deal can be won. These tests replay the
 * stored winning line of every shipped deal through the current rules, so a
 * rule change that invalidates a deal fails the build instead of reaching
 * players.
 */
describe("shipped deals", () => {
  it("exist for every variant and difficulty", () => {
    for (const variant of VARIANTS) {
      const list = JSON.parse(readFileSync(join(DEALS_DIR, `${variant.id}.json`), "utf8")) as DealList;
      for (const difficulty of DIFFICULTIES) {
        expect(list[difficulty]?.length ?? 0, `${variant.id}/${difficulty}`).toBeGreaterThanOrEqual(20);
      }
    }
  });

  describe.each(files)("%s", (file) => {
    const variant = getVariant(file.replace(".json", ""));
    const list = JSON.parse(readFileSync(join(DEALS_DIR, file), "utf8")) as DealList;

    it.each(DIFFICULTIES)("every %s deal replays to a win", (difficulty) => {
      const rules = variant.createRules(difficulty);
      const seeds = new Set<number>();
      for (const [seed, encoded] of list[difficulty] ?? []) {
        expect(seeds.has(seed), `duplicate seed ${seed}`).toBe(false);
        seeds.add(seed);
        let board = rules.deal(seed);
        for (const move of decodeMoves(encoded)) {
          expect(rules.isLegal(board, move), `${variant.id}/${difficulty} seed ${seed}`).toBe(true);
          board = rules.apply(board, move);
        }
        expect(rules.isWon(board), `${variant.id}/${difficulty} seed ${seed}`).toBe(true);
      }
    });
  });
});
