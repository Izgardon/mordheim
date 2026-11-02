import type { Setting } from "@/features/campaigns/types/campaign-types";
import { specialOption, warnedLast } from "@/features/catalogue/search-options";
import type { Special } from "@/features/special/types/special-types";

import { isInjury } from "./unit-view";

/** A general rule: not a hired sword's or dramatis persona's own, which stays with them. */
export const isGeneralRule = (special: Pick<Special, "owner_kind">) =>
  !special.owner_kind || special.owner_kind === "general";

/**
 * What a Boons & Banes picker offers (William: "can we not show the hired swords/dramatis ones
 * here"): the campaign's general boons, banes and traits, or its injuries, the greyed rows last.
 */
export function boonBaneOptions(
  specials: Special[],
  settings: Map<number, Setting>,
  injuries = false
) {
  return warnedLast(
    specials
      .filter((special) => isGeneralRule(special) && isInjury(special) === injuries)
      .map((special) => specialOption(special, settings))
  );
}
