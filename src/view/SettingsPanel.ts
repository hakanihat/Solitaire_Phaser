import type * as Phaser from "phaser";
import { type Settings, storage } from "../services/storage";
import { Button, Modal, Toggle } from "./ui";
import { uiScale } from "./viewport";

const OPTIONS: readonly { key: keyof Settings; label: string }[] = [
  { key: "sound", label: "Sound effects" },
  { key: "tapToMove", label: "Tap a card to move it" },
  { key: "autoFoundation", label: "Auto-play safe cards home" },
  { key: "leftHanded", label: "Left-handed layout" },
  { key: "showTimer", label: "Show timer" },
];

/** Opens the settings dialog. `onChange` fires after each toggle is saved. */
export function openSettings(scene: Phaser.Scene, accent: number, onChange?: (settings: Settings) => void): Modal {
  const ui = uiScale(scene);
  const font = 16 * ui;
  const width = Math.min(scene.scale.width * 0.9, 380 * ui);
  const rowHeight = font * 2.6;
  const height = font * 5.5 + OPTIONS.length * rowHeight + font * 3;
  const modal = new Modal(scene, { width, height, title: "Settings", titleSize: font * 1.4, accent });
  const settings = storage.settings();
  const top = -height / 2 + font * 4.4;
  OPTIONS.forEach((option, i) => {
    const toggle = new Toggle(scene, 0, top + i * rowHeight, {
      width: width - font * 3,
      label: option.label,
      fontSize: font,
      accent,
      value: settings[option.key],
      onChange: (value) => onChange?.(storage.updateSettings({ [option.key]: value })),
    });
    modal.panel.add(toggle);
  });
  const done = new Button(scene, 0, height / 2 - font * 2.4, {
    width: width * 0.5,
    height: font * 2.6,
    label: "Done",
    style: "primary",
    accent,
    fontSize: font * 1.05,
    onClick: () => modal.close(),
  });
  modal.panel.add(done);
  return modal;
}
