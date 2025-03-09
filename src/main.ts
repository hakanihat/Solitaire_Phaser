import * as Phaser from "phaser";
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';

import InitState from "./InitState";
import GameState from "./GameState";
import PreInitState from "./PreInitState";
 
const config: Phaser.Types.Core.GameConfig = {
  backgroundColor: "#fff",
  height: screen.height * devicePixelRatio,
  width: screen.width * devicePixelRatio+99,
  parent: "game-container",
  scene: [PreInitState, InitState, GameState],
  type: Phaser.AUTO,
 
  scale: {
    mode: Phaser.Scale.FIT,
  },
  plugins: {
    scene: [
      {
        key: 'rexUI',
        plugin: UIPlugin,
        mapping: 'rexUI',
      },
      // Add other plugins as needed
      
    ],
  },
};

export const game = new Phaser.Game(config);
