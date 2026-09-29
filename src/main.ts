import * as Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { LoadingScene } from "./scenes/LoadingScene";
import { MenuScene } from "./scenes/MenuScene";
import { setupPlatform } from "./services/platform";
import { DPR, trackViewport, viewportSize } from "./view/viewport";

const { width, height } = viewportSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#0b3d24",
  width,
  height,
  // Render at physical resolution and scale down with CSS for crisp cards.
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / DPR },
  render: { antialias: true, roundPixels: false },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, LoadingScene, GameScene],
});

trackViewport(game);
void setupPlatform(game);

if (import.meta.env.DEV) {
  // Handy for debugging and automated visual checks; stripped from production builds.
  (window as unknown as { solitaire: Phaser.Game }).solitaire = game;
}
