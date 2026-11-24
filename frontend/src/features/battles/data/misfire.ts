import type { CriticalHitTable } from "./critical-hits";

/**
 * The blackpowder Misfire chart, rolled when a blackpowder weapon misfires (the Black Powder
 * Improvements house rule: on a roll to hit of 1). It lives in the Ranged tool beside the missile
 * critical hits (William, 24 Nov 2026: "Ranged menu should show the Misfire Chart just like it
 * shows the crit chart"), worded as Mutiny in Marienburg's Blackpowder Misfires table.
 */
export const MISFIRE_TABLE: CriticalHitTable = {
  id: "misfire",
  label: "Blackpowder Weapons",
  heading: "Misfire chart · Blackpowder Weapons",
  entries: [
    {
      roll: "1",
      result:
        "BOOM! The shooter takes a Strength 4 hit (no critical hits) and the weapon is destroyed.",
    },
    {
      roll: "2",
      result:
        "Jammed. The weapon is useless for the rest of the battle, but works again in the next one.",
    },
    {
      roll: "3",
      result:
        "Phut. It fails to fire and the shot is lost: the shooter waits an extra turn before he can fire it again.",
    },
    { roll: "4-5", result: "Click. It fails to fire, with no other effect." },
    { roll: "6", result: "KA-BOOM! The shot hits the target at +1 Strength." },
  ],
};
