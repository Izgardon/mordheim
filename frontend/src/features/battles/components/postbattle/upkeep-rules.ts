import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";

/**
 * Whether a roster hireling owes upkeep after the battle: not one who stays for one battle (he
 * leaves after it, and the server suggests no upkeep for him).
 */
export const paysUpkeep = (hireling: Pick<PrebattleUnit, "stays">) =>
  hireling.stays !== "one_battle";
