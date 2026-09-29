import { Capacitor } from "@capacitor/core";
import type * as Phaser from "phaser";
import { SceneKey } from "../scenes/keys";

/**
 * Native (Android) integration. The Android back button returns to the menu
 * from a game and closes the app from the menu, as players expect.
 */
export async function setupPlatform(game: Phaser.Game): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", () => {
    const inMenu = game.scene.isActive(SceneKey.Menu);
    if (inMenu) {
      void App.exitApp();
      return;
    }
    for (const key of [SceneKey.Game, SceneKey.Loading]) {
      if (game.scene.isActive(key)) {
        game.scene.getScene(key).scene.start(SceneKey.Menu);
      }
    }
  });
}
