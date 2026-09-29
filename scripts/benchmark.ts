/**
 * Measures how well the solver handles a variant — useful when tuning a
 * variant's heuristics or adding a new game.
 *
 *   npm run benchmark -- <variant> [--deals 20] [--nodes 200000] [--strategy best-first]
 */
import { DIFFICULTIES } from "../src/core/Rules";
import { type SearchStrategy, solve } from "../src/core/solver";
import { getVariant } from "../src/variants";

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const variant = getVariant(process.argv[2] ?? "");
const deals = Number(argument("deals", "20"));
const maxNodes = Number(argument("nodes", String(variant.solver.verifyNodes)));
const strategy = argument("strategy", variant.solver.strategy) as SearchStrategy;

for (const difficulty of DIFFICULTIES) {
  const rules = variant.createRules(difficulty);
  const tally = { solved: 0, unsolvable: 0, unknown: 0, nodes: 0, length: 0 };
  const started = performance.now();
  for (let seed = 1; seed <= deals; seed += 1) {
    const result = solve(rules, rules.deal(seed), { maxNodes, strategy });
    if (result.status === "solved") {
      tally.solved += 1;
      tally.nodes += result.nodes;
      tally.length += result.path.length;
    } else if (result.status === "unsolvable") {
      tally.unsolvable += 1;
    } else {
      tally.unknown += 1;
    }
  }
  const perDeal = (performance.now() - started) / deals;
  const solved = Math.max(1, tally.solved);
  console.log(
    `${variant.id}/${difficulty} [${strategy}]: solved ${tally.solved}/${deals}, unsolvable ${tally.unsolvable}, ` +
      `unknown ${tally.unknown} | avg nodes ${Math.round(tally.nodes / solved)}, avg length ${Math.round(tally.length / solved)}, ${Math.round(perDeal)} ms/deal`
  );
}
