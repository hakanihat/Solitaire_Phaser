import type * as Phaser from "phaser";

/*
 * Keeps touch input healthy across app switches.
 *
 * Phaser gives each finger a touch slot and frees it on the matching
 * touchend/touchcancel. Phones can swallow that event when the app goes to
 * the background mid-touch (home swipe, notification shade, incoming call).
 * The slot then stays "held" forever; once every slot is held, all new taps
 * are ignored and the game looks frozen although it is still running.
 */

/** Emitted on `game.events` when gestures in progress should be abandoned. */
export const INPUT_RESET = "input-reset";

function releaseTouch(pointer: Phaser.Input.Pointer): void {
  // `reset` clears the pointer and marks touch slots free again.
  pointer.reset();
}

/** Frees every touch slot and tells scenes to drop half-finished gestures. */
function releaseAll(game: Phaser.Game): void {
  const pointers = game.input?.pointers ?? [];
  let released = false;
  for (const pointer of pointers) {
    if (pointer.id !== 0 && pointer.active) {
      releaseTouch(pointer);
      released = true;
    }
  }
  if (released || document.hidden) {
    game.events.emit(INPUT_RESET);
  }
}

/**
 * Before Phaser sees a new touch, frees slots held by fingers that are no
 * longer on the screen (the browser lists the ones that are in `touches`).
 */
function releaseStaleTouches(game: Phaser.Game, event: TouchEvent): void {
  const down = new Set(Array.from(event.touches, (touch) => touch.identifier));
  let released = false;
  for (const pointer of game.input?.pointers ?? []) {
    if (pointer.id !== 0 && pointer.active && !down.has(pointer.identifier)) {
      releaseTouch(pointer);
      released = true;
    }
  }
  if (released) {
    game.events.emit(INPUT_RESET);
  }
}

export function setupLifecycle(game: Phaser.Game): void {
  const leave = (): void => releaseAll(game);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      leave();
    }
  });
  window.addEventListener("pagehide", leave);
  window.addEventListener("blur", leave);
  // Capture phase: runs before Phaser's own touchstart handler.
  window.addEventListener("touchstart", (event) => releaseStaleTouches(game, event), {
    capture: true,
    passive: true,
  });
}
