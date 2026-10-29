import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";

/**
 * Whether a roster hireling owes upkeep after the battle: not one who stays for one battle (he
 * leaves after it), nor one missing games (he missed this battle); the server suggests no upkeep
 * for either. One wounded in this battle still owes it: he fought.
 */
export const paysUpkeep = (hireling: Pick<PrebattleUnit, "stays" | "missingGames">) =>
  hireling.stays !== "one_battle" && !((hireling.missingGames ?? 0) > 0);
