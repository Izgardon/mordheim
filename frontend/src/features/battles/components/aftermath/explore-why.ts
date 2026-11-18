import { useState } from "react";

/** "3 heroes on their feet, +1 for winning": why the exploration has the dice it has. */
export const exploreWhy = (onFeet: number, won: boolean) =>
  `${onFeet} ${onFeet === 1 ? "hero" : "heroes"} on their feet${won ? ", +1 for winning" : ""}`;

/**
 * The words stop moving when the dice do (William, 12 Nov 2026, on the exploration: the dice must
 * not recalculate once rolled). The dice are kept as they were thrown, so the line beside them has
 * to describe the roll that happened: declaring a different result afterwards, or standing a hero
 * up on the Injuries step, changes the battle's record and not the roll already made. Before the
 * roll the line follows the battle as it stands, and it does so again if the dice are cleared.
 */
export function useExploreWhy(rolled: boolean, live: string) {
  const [held, setHeld] = useState<string | null>(rolled ? live : null);
  if (rolled && held === null) setHeld(live);
  if (!rolled && held !== null) setHeld(null);
  return held ?? live;
}
