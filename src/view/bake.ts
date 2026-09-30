import type * as Phaser from "phaser";

/*
 * Phaser rebuilds the triangles of every Graphics object on every frame, so a
 * screen full of static vector shapes (icons, panels, pile outlines) costs CPU
 * time for nothing. Shapes that never change are drawn once into a texture,
 * antialiased by the canvas, and shown as a plain image instead.
 */

/**
 * Returns an image of `paint`'s drawing, rendered once into a cached
 * `width` × `height` texture under `key`. `paint` draws in texture space
 * (0, 0 is the top-left corner); the image's origin is its centre.
 */
export function bakedImage(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  paint: (g: Phaser.GameObjects.Graphics) => void
): Phaser.GameObjects.Image {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    paint(g);
    g.generateTexture(key, Math.ceil(width), Math.ceil(height));
    g.destroy();
  }
  return scene.add.image(0, 0, key);
}
