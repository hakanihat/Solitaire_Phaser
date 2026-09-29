import type * as Phaser from "phaser";
import { storage } from "./storage";

export type Sfx = "place" | "foundation" | "shuffle" | "win" | "invalid";

/** Asset key and base volume for each sound effect. */
export const SOUND_FILES: Readonly<Record<Exclude<Sfx, "invalid">, { key: string; file: string; volume: number }>> = {
  place: { key: "sfx_place", file: "assets/sfx/place_card.wav", volume: 0.7 },
  foundation: { key: "sfx_foundation", file: "assets/sfx/foundation_sound.wav", volume: 0.45 },
  shuffle: { key: "sfx_shuffle", file: "assets/sfx/shuffle.wav", volume: 0.6 },
  win: { key: "sfx_win", file: "assets/sfx/win_sound.wav", volume: 0.6 },
};

/** Plays a sound effect if sound is enabled in the settings. */
export function playSfx(scene: Phaser.Scene, sfx: Sfx, rate = 1): void {
  if (!storage.settings().sound) {
    return;
  }
  if (sfx === "invalid") {
    // A soft, low "tock" made by slowing down the card sound.
    scene.sound.play(SOUND_FILES.place.key, { volume: 0.35, rate: 0.55 });
    return;
  }
  const { key, volume } = SOUND_FILES[sfx];
  scene.sound.play(key, { volume, rate });
}
