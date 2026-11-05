import type { SpecialCategory, SpecialKind } from "@/components/ui/game-icons";
import type { Setting } from "@/features/campaigns/types/campaign-types";
import {
  ALL_SETTINGS,
  entrySettingKey,
  inPlayOnly,
  settingKeyOptions,
} from "@/features/reference/in-play";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { Special } from "./types/special-types";

export const SPECIAL_KIND_LABELS: Record<SpecialKind, string> = {
  boon: "Boon",
  bane: "Bane",
  trait: "Trait",
};

export type CategoryFilter = SpecialCategory | "all";

export const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "injury", label: "Injury" },
  { id: "mutation", label: "Mutation" },
  { id: "aura", label: "Aura" },
  { id: "body", label: "Body" },
];

/** A special's category, an aura when it has none (as the server's default is). */
export const categoryOf = (special: Special): SpecialCategory => special.category ?? "aura";

/**
 * The Boons & Banes the reference lists: the general rules in play in the campaign, as the pickers
 * offer. A warband's, hired sword's or dramatis persona's own rules show with them (the Warbands
 * page, the hired swords).
 */
export const referenceSpecials = (specials: Special[]) =>
  inPlayOnly(specials).filter((special) => !special.owner_kind || special.owner_kind === "general");

type BoonBaneFilters = {
  query: string;
  category: CategoryFilter;
  setting: string;
  settings: Map<number, Setting>;
  /** The row a link opened (`?open=`): it stays whatever the filters. */
  openId: string | null;
};

/**
 * The Boons & Banes page's rows by name, searched by name, type or rules and filtered by category
 * and setting (Mordheim's grades and its ungraded book rows as one), with each category's count
 * and the settings the rows hold.
 */
export function boonBaneRows(specials: Special[], filters: BoonBaneFilters) {
  const { query, category, setting, settings, openId } = filters;
  const all = referenceSpecials(specials).sort((a, b) => a.name.localeCompare(b.name));
  const searched = all.filter(
    (special) =>
      (setting === ALL_SETTINGS || entrySettingKey(special, settings) === setting) &&
      matchesSearchQuery(query, special.name, special.type, special.description)
  );
  const rows = all.filter(
    (special) =>
      String(special.id) === openId ||
      (searched.includes(special) && (category === "all" || categoryOf(special) === category))
  );
  const counts = CATEGORY_FILTERS.map((entry) => ({
    ...entry,
    count:
      entry.id === "all"
        ? searched.length
        : searched.filter((special) => categoryOf(special) === entry.id).length,
  }));
  const settingOptions = settingKeyOptions(
    all.map((special) => entrySettingKey(special, settings)),
    settings
  );
  return { rows, counts, settingOptions };
}
