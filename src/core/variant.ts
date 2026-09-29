import type { PileKind } from "./layout";
import type { Difficulty, Rules } from "./Rules";
import type { SearchStrategy } from "./solver";

export interface DifficultyInfo {
  /** Short label shown on the difficulty button, e.g. "Draw 1". */
  readonly label: string;
  /** One-line explanation of what changes. */
  readonly detail: string;
}

export interface TutorialStep {
  readonly title: string;
  readonly text: string;
  /** Pile kinds to spotlight on the real table while this step is shown. */
  readonly highlight?: readonly PileKind[];
}

/** Decorative motif painted on the table and loading screen. */
export type Pattern =
  "felt" | "diamonds" | "waves" | "rays" | "hexagons" | "dots" | "stripes" | "stars" | "web" | "scales" | "bricks";

/** Slow particle atmosphere drawn over the table. */
export type Ambient = "motes" | "snow" | "bubbles" | "embers" | "sand" | "petals" | "twinkle";

export interface VariantTheme {
  /** Table gradient, centre → edge. */
  readonly table: readonly [number, number];
  /** Highlight colour for buttons, glows and particles. */
  readonly accent: number;
  readonly pattern: Pattern;
  readonly ambient: Ambient;
  /** How the loading screen arranges its cards. */
  readonly intro: "fan" | "pyramid" | "peaks" | "cascade" | "spiral" | "twins" | "grid" | "columns";
}

export interface SolverProfile {
  readonly strategy: SearchStrategy;
  /** Node budget used when verifying a fresh deal is winnable. */
  readonly verifyNodes: number;
  /** Node budget for a hint request (kept small to stay responsive). */
  readonly hintNodes: number;
  /**
   * Optional extra deal filter by solver effort. Where the rules themselves do
   * not change between levels, "easy" deals are those the solver cracks with
   * little search and "hard" deals are those that needed a lot of it.
   */
  readonly effort?: Partial<Record<Difficulty, { readonly minNodes?: number; readonly maxNodes?: number }>>;
}

/**
 * Everything the app needs to know about a solitaire game: presentation data
 * plus a factory for its rules. Adding a new game means writing one of these
 * and registering it — no scene or UI code changes.
 */
export interface VariantDefinition {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  /** Games designed for this collection rather than traditional ones. */
  readonly original?: boolean;
  readonly difficulties: Readonly<Record<Difficulty, DifficultyInfo>>;
  readonly tutorial: readonly TutorialStep[];
  readonly theme: VariantTheme;
  readonly solver: SolverProfile;
  createRules(difficulty: Difficulty): Rules;
}
