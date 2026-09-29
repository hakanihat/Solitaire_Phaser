# Solitaire Collection

Ten solitaire games in one Phaser 3 app — eight classics and two originals — with
guaranteed-winnable deals, three difficulty levels each, interactive tutorials, a
solver-backed hint system and no ads.

| Game          | Easy                  | Medium                | Hard                              |
| ------------- | --------------------- | --------------------- | --------------------------------- |
| Klondike      | Draw 1                | Draw 3                | Draw 3, three passes              |
| Spider        | 1 suit                | 2 suits               | 2 suits, hardest verified deals\* |
| FreeCell      | 4 cells, gentle deals | 4 cells               | 3 cells                           |
| Pyramid       | Unlimited passes      | 3 passes              | 2 passes                          |
| TriPeaks      | Open, K↔A wraps       | Hidden, K↔A wraps     | Hidden, no wrap                   |
| Golf          | K↔A wraps             | No wrap               | No wrap, nothing on a King        |
| Yukon         | Gentle deals          | Classic               | Russian (same suit)               |
| Scorpion      | Open, any card to gap | Classic               | Classic, harder deals             |
| **Meridian**  | 3 free cells          | 2 free cells          | 1 free cell                       |
| **Gemini**    | Open, K↔A wraps       | Hidden, K↔A wraps     | Hidden, no wrap                   |

\* Four-suit Spider cannot be verified winnable by the solver in reasonable time,
so it is not offered (see _Winnable deals_).

### The original games

- **Meridian** — every suit has a _Sunrise_ foundation (Ace upward) and a _Sunset_
  foundation (King downward); the suit is complete when they meet, wherever that is.
  All cards are face-up; cards move singly onto the same suit one rank up _or_ down.
  It turns each suit into a small routing puzzle: dig for the low end or the high end?
- **Gemini** — two pyramids above two waste piles, the Sun and the Moon. Play any
  uncovered card onto either twin if it is one rank away; the stock feeds both twins at
  once. Two chains instead of one turn TriPeaks-style luck into planning.

## Running

```bash
npm install
npm run dev        # development server
npm run build      # type-check + production build into dist/
npm test           # unit tests, including replaying every shipped deal
npm run lint
```

Android (Capacitor): `npm run build && npx cap sync android`, then open `android/` in
Android Studio.

## Architecture

```
src/
  core/       Pure TypeScript game model — no Phaser. Used by the UI, tests and scripts.
    Rules.ts        Base class every variant implements (pick/drop rules, deal, win)
    board.ts        Compact board state (card ids per pile + face-down counts)
    GameSession.ts  A game in progress: moves, undo (grouped with auto-moves), score
    solver.ts       Generic depth-first / best-first solver with transposition table
    hints.ts        Hint AI: winning-line cache, live search, dead-end detection
    tapMove.ts      Chooses the destination when a card is tapped
  variants/   One file per game: rules, layout, difficulties, tutorial, theme
  scenes/     Boot → Menu → Loading (per-game theme) → Game
  view/       Rendering: BoardView (declarative board rendering), CardView, HUD,
              tutorial overlay, effects, procedural table backgrounds, UI kit
  services/   Storage (settings, stats, save/resume), audio, deal lists, Android hooks
  data/deals/ Pre-verified winnable deals (generated, loaded per game on demand)
scripts/
  generate-deals.ts  Builds data/deals/*.json
  benchmark.ts       Measures solver performance for a variant
```

Key design decisions:

- **Rules are data-driven and stateless.** A `Rules` instance answers questions about
  immutable `Board`s. The same rules power rendering, input validation, the solver,
  hints, autoplay, tests and the deal generator, so they can never disagree.
- **Declarative rendering.** `BoardView.render(board)` computes where every card
  belongs and animates only what changed. Moves, undo, deals and autoplay all use this
  one path.
- **Layouts in card units.** Variants describe piles in card widths/heights; the view
  fits them to any screen, including left-handed mirroring.

## Winnable deals

Every deal is guaranteed winnable. `scripts/generate-deals.ts` solves candidate deals
offline, keeps only solved ones (optionally filtered by solver effort for difficulty),
**replays each solution through the rules** as an independent check, and stores the
seed together with its winning line. The loading screen replays the line once more
before the game starts, and `tests/deals.test.ts` replays every shipped deal.

Shipping the winning line also makes hints instant and certain while the player stays
on it, and lets the hint AI tell the player exactly how many moves to undo when they
have made the game unwinnable.

## Adding a game

1. Create `src/variants/<name>.ts` with a `Rules` subclass (implement `deal`, `canPick`,
   `canDrop`, and optionally `canDraw`/`performDraw`, `safeAutoMove`, `evaluate`) and a
   `VariantDefinition` (difficulties, tutorial, theme, solver profile).
2. Register it in `src/variants/index.ts`.
3. Tune the solver with `npm run benchmark -- <name>`, then generate deals with
   `npm run deals -- <name>`.
4. `npm test` checks deals, determinism, card conservation and tutorials automatically.

## Credits

Card artwork: the original `assets/img/cards2.png`. Built with [Phaser 3](https://phaser.io).
Licensed under MIT (see `LICENSE.md`).
