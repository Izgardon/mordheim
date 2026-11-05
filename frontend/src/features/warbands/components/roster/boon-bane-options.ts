import type { Setting } from "@/features/campaigns/types/campaign-types";
import { specialOption, warnedLast } from "@/features/catalogue/search-options";
import type { Special } from "@/features/special/types/special-types";

/** A general rule: not a hired sword's, dramatis persona's or template fighter's own, which stays with them. */
export const isGeneralRule = (special: Pick<Special, "owner_kind">) =>
  !special.owner_kind || special.owner_kind === "general";

/**
 * What a Boons & Banes picker offers (William: "can we not show the hired swords/dramatis ones
 * here"): the campaign's general boons, banes and traits, its injuries among them, the greyed rows
 * last; those he has (`held`, by id) are left out, as the Edit form's list leaves them.
 */
export function boonBaneOptions(
  specials: Special[],
  settings: Map<number, Setting>,
  held: { id: number }[] = []
) {
  const his = new Set(held.map((special) => special.id));
  return warnedLast(
    specials
      .filter((special) => isGeneralRule(special) && !his.has(special.id))
      .map((special) => specialOption(special, settings))
  );
}
