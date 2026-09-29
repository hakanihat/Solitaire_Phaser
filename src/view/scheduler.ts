import * as Phaser from "phaser";

/**
 * Runs a generator-based task a few milliseconds per frame so long searches
 * (hints, auto-finish planning) never freeze the game. Returns a cancel function.
 */
export function runSliced<T>(
  scene: Phaser.Scene,
  task: Generator<void, T>,
  onDone: (value: T) => void,
  budgetMs = 4
): () => void {
  let active = true;
  const stop = (): void => {
    active = false;
    scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
  };
  function tick(): void {
    const start = performance.now();
    while (active) {
      const step = task.next();
      if (step.done === true) {
        stop();
        onDone(step.value);
        return;
      }
      if (performance.now() - start > budgetMs) {
        return;
      }
    }
  }
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  return stop;
}

/** Promise that resolves after `ms` of game time. */
export const wait = (scene: Phaser.Scene, ms: number): Promise<void> =>
  new Promise((resolve) => scene.time.delayedCall(ms, resolve));
