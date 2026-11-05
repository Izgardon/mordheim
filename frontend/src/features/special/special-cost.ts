import type { Special } from "./types/special-types";

/** "35 gc": a special's price where a list sells it (a mutation's); "" for none. */
export const specialCost = (special: Pick<Special, "cost">) =>
  special.cost === null || special.cost === undefined ? "" : `${special.cost} gc`;
