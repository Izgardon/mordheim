import { inPlayOnly } from "@/features/reference/in-play";
import { byNumber } from "@/features/reference/list-sort";
import type { SortOption } from "@/features/reference/SortMenu";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import { BEAST_KINDS, beastKindLabel } from "./bestiary-kinds";
import type { BestiaryEntrySummary } from "./types/bestiary-types";

export type BeastSort = "name" | "cost" | "-cost" | "kind";

/** The Bestiary's orders (William, 26 Nov 2026: name, cost and type). */
export const BEAST_SORTS: SortOption<BeastSort>[] = [
  { id: "name", label: "Name" },
  { id: "cost", label: "Cost: low to high" },
  { id: "-cost", label: "Cost: high to low" },
  { id: "kind", label: "Kind: mounts, pets, creatures" },
];

/** What the store sells it at (its first price's gold, dice left out); none when not sold. */
const costOf = (entry: BestiaryEntrySummary) => {
  const price = entry.available_in_shop ? entry.item?.availabilities?.[0] : undefined;
  return price ? (price.cost ?? 0) : null;
};

const ORDERS: Record<
  Exclude<BeastSort, "name">,
  (a: BestiaryEntrySummary, b: BestiaryEntrySummary) => number
> = {
  cost: byNumber(costOf),
  "-cost": byNumber(costOf, true),
  kind: byNumber((entry) => BEAST_KINDS.indexOf(entry.kind)),
};

/**
 * The Bestiary's rows: the beasts in play the search (name, text or kind) keeps, and the open one
 * whatever it says, by name or in the order picked (each tie by name).
 */
export function beastRows(
  entries: BestiaryEntrySummary[],
  { query, openId, sort }: { query: string; openId: string | null; sort: BeastSort }
) {
  const rows = inPlayOnly(entries)
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(
      (entry) =>
        String(entry.id) === openId ||
        matchesSearchQuery(query, entry.name, entry.description, beastKindLabel(entry.kind))
    );
  return sort === "name" ? rows : rows.sort(ORDERS[sort]);
}
