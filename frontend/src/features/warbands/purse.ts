import { createContext, useContext } from "react";

/**
 * What the store and the recruit tally count a spend against: a campaign warband's gold, or a
 * workshop warband's running cost (apps/workshop), which has no budget (William, 27 Nov 2026:
 * "it shouldn't matter here, we just need a running cost").
 */
export type Purse = { kind: "gold" } | { kind: "cost"; cost: number };

export const PurseContext = createContext<Purse>({ kind: "gold" });

export const usePurse = () => useContext(PurseContext);

/** A workshop's "Cost 108 → 168 gc" once `total` is spent; null in a campaign. */
export function costAfter(purse: Purse, total: number): string | null {
  return purse.kind === "cost" ? `Cost ${purse.cost} → ${purse.cost + total} gc` : null;
}
