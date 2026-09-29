import type { VariantDefinition } from "../core/variant";
import { freecell } from "./freecell";
import { gemini } from "./gemini";
import { golf } from "./golf";
import { klondike } from "./klondike";
import { meridian } from "./meridian";
import { pyramid } from "./pyramid";
import { scorpion } from "./scorpion";
import { spider } from "./spider";
import { tripeaks } from "./tripeaks";
import { yukon } from "./yukon";

/** Every game in the collection, in menu order. Register new games here. */
export const VARIANTS: readonly VariantDefinition[] = [
  klondike,
  spider,
  freecell,
  pyramid,
  tripeaks,
  golf,
  yukon,
  scorpion,
  meridian,
  gemini,
];

export function getVariant(id: string): VariantDefinition {
  const variant = VARIANTS.find((candidate) => candidate.id === id);
  if (!variant) {
    throw new Error(`Unknown variant "${id}"`);
  }
  return variant;
}
