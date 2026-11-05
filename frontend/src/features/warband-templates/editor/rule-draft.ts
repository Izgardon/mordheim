import { createElement } from "react";

import { SpecialIcon, type SpecialCategory, type SpecialKind } from "@/components/ui/game-icons";
import type { SearchOption } from "@/components/ui/search-select";
import type { Special } from "@/features/special/types/special-types";

/**
 * A rule a fighter has or an upgrade gives, as the editor holds it: a special picked (its id), or
 * one written here (no id yet), which the save makes the template's own ("Warband - <name>").
 */
export type RuleDraft = {
  special_id: number | null;
  name: string;
  kind: SpecialKind;
  /** Its icon: an aura unless picked. */
  category: SpecialCategory;
  description: string;
};

/** The template's own specials' type, as the server writes it. */
export const ownType = (templateName: string) => `Warband - ${templateName}`;

/**
 * What the rule pickers offer: the template's own rules first, then the general ones, then other
 * warbands' own; never a hired sword's or dramatis persona's own rule.
 */
export function ruleOptions(specials: Special[], templateName: string): SearchOption[] {
  const own = ownType(templateName);
  const group = (special: Special) =>
    special.type === own ? 0 : special.owner_kind === "warband" ? 2 : 1;
  const labels = ["This template's", "General", "Other warbands'"];
  return specials
    .filter((special) => !special.owner_kind || ["general", "warband"].includes(special.owner_kind))
    .map((special) => ({ special, at: group(special) }))
    .sort((a, b) => a.at - b.at)
    .map(({ special, at }) => ({
      id: special.id,
      title: special.name,
      subtitle: special.type ?? undefined,
      group: labels[at],
      icon: createElement(SpecialIcon, { category: special.category, kind: special.kind }),
    }));
}

/** A picked option as a draft, from the specials it came from. */
export function pickedRule(specials: Special[], id: number): RuleDraft | null {
  const special = specials.find((row) => row.id === id);
  if (!special) return null;
  return {
    special_id: special.id,
    name: special.name,
    kind: special.kind ?? "trait",
    category: special.category ?? "aura",
    description: special.description ?? "",
  };
}
