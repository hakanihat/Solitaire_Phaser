import type * as Phaser from "phaser";

/*
 * The game renders with `roundPixels`, which snaps every sprite to whole
 * pixels: text, icons and resting cards stay crisp. Moving sprites pay for
 * it, though. A slow drift advances in visible one-pixel steps, and a
 * rotating sprite wobbles because Phaser snaps its corner independently of
 * its angle. Sprites registered here skip snapping while they are in motion
 * and snap again once they come to rest.
 */

/** Camera flags read by the renderer while it batches one sprite. */
interface CameraRounding {
  roundPixels: boolean;
  renderRoundPixels: boolean;
}

/** Phaser's per-object render hook: (renderer, object, camera, ...parent). */
type RenderFn = (renderer: unknown, object: unknown, camera: CameraRounding, ...parent: unknown[]) => void;

interface Renderable {
  renderWebGL?: RenderFn;
  renderCanvas?: RenderFn;
}

function withoutSnapping(render: RenderFn, inMotion: () => boolean): RenderFn {
  return function (this: unknown, renderer, object, camera, ...parent) {
    if (!camera.roundPixels || !inMotion()) {
      render.call(this, renderer, object, camera, ...parent);
      return;
    }
    const { roundPixels, renderRoundPixels } = camera;
    camera.roundPixels = false;
    camera.renderRoundPixels = false;
    try {
      render.call(this, renderer, object, camera, ...parent);
    } finally {
      camera.roundPixels = roundPixels;
      camera.renderRoundPixels = renderRoundPixels;
    }
  };
}

/**
 * Renders `object` at sub-pixel precision whenever `inMotion()` is true
 * (always, by default — for sprites that idle-animate forever).
 */
export function smoothMotion<T extends Phaser.GameObjects.GameObject>(
  object: T,
  inMotion: () => boolean = () => true
): T {
  const renderable = object as unknown as Renderable;
  if (renderable.renderWebGL) {
    renderable.renderWebGL = withoutSnapping(renderable.renderWebGL, inMotion);
  }
  if (renderable.renderCanvas) {
    renderable.renderCanvas = withoutSnapping(renderable.renderCanvas, inMotion);
  }
  return object;
}
