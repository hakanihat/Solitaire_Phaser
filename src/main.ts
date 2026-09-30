import * as Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { LoadingScene } from "./scenes/LoadingScene";
import { MenuScene } from "./scenes/MenuScene";
import { setupLifecycle } from "./services/lifecycle";
import { setupPlatform } from "./services/platform";
import { renderRatio, trackViewport, viewportSize } from "./view/viewport";

const { width, height } = viewportSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#0b3d24",
  width,
  height,
  // Render at physical resolution and scale down with CSS for crisp cards.
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / renderRatio() },
  render: {
    // Smooth texture sampling; roundPixels keeps text, icons and resting cards on whole pixels (no blur).
    antialias: true,
    roundPixels: true,
    // Card edges are antialiased inside their images and shapes are pre-drawn, so GPU multisampling
    // would only cost fill rate (noticeable in fullscreen).
    antialiasGL: false,
    // Prefer the discrete GPU on laptops that have two.
    powerPreference: "high-performance",
  },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, LoadingScene, GameScene],
});

trackViewport(game);
setupLifecycle(game);
void setupPlatform(game);

if (import.meta.env.DEV) {
  // Handy for debugging and automated visual checks; stripped from production builds.
  (window as unknown as { solitaire: Phaser.Game }).solitaire = game;
}
