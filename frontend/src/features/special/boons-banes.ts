import type { SpecialCategory, SpecialKind } from "@/components/ui/game-icons";
import type { Setting } from "@/features/campaigns/types/campaign-types";
import {
  ALL_SETTINGS,
  entrySettingKey,
  inPlayOnly,
  settingKeyOptions,
} from "@/features/reference/in-play";
import { byNumber } from "@/features/reference/list-sort";
import type { SortOption } from "@/features/reference/SortMenu";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { Special } from "./types/special-types";

export const SPECIAL_KIND_LABELS: Record<SpecialKind, string> = {
  boon: "Boon",
  bane: "Bane",
  trait: "Trait",
};

export type SpecialSort = "name" | "kind";

/** The Specials page's orders (William, 26 Nov 2026); the category is its filter. */
export const SPECIAL_SORTS: SortOption<SpecialSort>[] = [
  { id: "name", label: "Name" },
  { id: "kind", label: "Kind: boon, bane, trait" },
];

const KIND_ORDER: SpecialKind[] = ["boon", "bane", "trait"];

/** Boons, then banes, then traits, a special with no kind last; each part by name. */
const byKind = byNumber((special: Special) =>
  special.kind ? KIND_ORDER.indexOf(special.kind) : null
);

export type CategoryFilter = SpecialCategory | "all";

export const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "injury", label: "Injury" },
  { id: "mutation", label: "Mutation" },
  { id: "aura", label: "Aura" },
  { id: "body", label: "Physical" },
];

/** A special's category, an aura when it has none (as the server's default is). */
export const categoryOf = (special: Special): SpecialCategory => special.category ?? "aura";

/**
 * The Specials the reference lists: the general rules in play in the campaign, as the pickers
 * offer. A warband's, hired sword's, dramatis persona's or beast's own rules show with them (the
 * Warbands page, the hired swords, the Bestiary; William, 7 Nov 2026: "keep bestiary rules from
 * displaying on the boons and banes page, show on beast for sure").
 */
export const referenceSpecials = (specials: Special[]) =>
  inPlayOnly(specials).filter((special) => !special.owner_kind || special.owner_kind === "general");

type BoonBaneFilters = {
  query: string;
  category: CategoryFilter;
  setting: string;
  sort: SpecialSort;
  settings: Map<number, Setting>;
  /** The campaign's own as the Setting filter names it (`useOwnWords().Place`). */
  own?: string;
  /** The row a link opened (`?open=`): it stays whatever the filters. */
  openId: string | null;
};

/**
 * The Specials page's rows by name (or by kind), searched by name, type or rules and filtered by category
 * and setting (Mordheim's grades and its ungraded book rows as one), with each category's count
 * and the settings the rows hold.
 */
export function boonBaneRows(specials: Special[], filters: BoonBaneFilters) {
  const { query, category, setting, sort, settings, own, openId } = filters;
  const all = referenceSpecials(specials).sort((a, b) => a.name.localeCompare(b.name));
  const searched = all.filter(
    (special) =>
      (setting === ALL_SETTINGS || entrySettingKey(special, settings) === setting) &&
      matchesSearchQuery(query, special.name, special.type, special.description)
  );
  const kept = all.filter(
    (special) =>
      String(special.id) === openId ||
      (searched.includes(special) && (category === "all" || categoryOf(special) === category))
  );
  const rows = sort === "kind" ? [...kept].sort(byKind) : kept;
  const counts = CATEGORY_FILTERS.map((entry) => ({
    ...entry,
    count:
      entry.id === "all"
        ? searched.length
        : searched.filter((special) => categoryOf(special) === entry.id).length,
  }));
  const settingOptions = settingKeyOptions(
    all.map((special) => entrySettingKey(special, settings)),
    settings,
    own
  );
  return { rows, counts, settingOptions };
}
