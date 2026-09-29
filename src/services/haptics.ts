import { storage } from "./storage";

export type Haptic = "drop" | "invalid" | "win";

const PATTERNS: Record<Haptic, number | number[]> = {
  drop: 8,
  invalid: [18, 40, 18],
  win: [30, 60, 30, 60, 60],
};

/** Short vibration feedback on touch devices (Android WebView supports it). */
export function haptic(kind: Haptic): void {
  if (!storage.settings().vibration || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw when vibration isn't allowed; feedback is optional.
  }
}
