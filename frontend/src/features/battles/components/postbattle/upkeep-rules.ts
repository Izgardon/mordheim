import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";

/**
 * Whether a roster hireling owes upkeep after the battle: not one who stays for one battle (he
 * leaves after it), nor one missing games (he missed this battle), nor one whose upkeep is none
 * (the fees step: "n/a"); the server suggests no upkeep for any of them. One wounded in this
 * battle still owes it: he fought.
 */
export const paysUpkeep = (hireling: Pick<PrebattleUnit, "stays" | "missingGames" | "upkeepFee">) =>
  hireling.stays !== "one_battle" &&
  !((hireling.missingGames ?? 0) > 0) &&
  hireling.upkeepFee?.kind !== "none";
