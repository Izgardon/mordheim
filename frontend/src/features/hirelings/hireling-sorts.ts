import { byNumber } from "@/features/reference/list-sort";
import type { SortOption } from "@/features/reference/SortMenu";

import type { Fee } from "./fees";
import type { HirelingCatalogueKind } from "./hireling-catalogue-kinds";
import type { HirelingProfile } from "./types/hireling-catalogue-types";

export type HirelingSort = "name" | "hire" | "-hire" | "upkeep" | "-upkeep" | "rating" | "-rating";

const FEES: SortOption<HirelingSort>[] = [
  { id: "name", label: "Name" },
  { id: "hire", label: "Hire fee: low to high" },
  { id: "-hire", label: "Hire fee: high to low" },
  { id: "upkeep", label: "Upkeep: low to high" },
  { id: "-upkeep", label: "Upkeep: high to low" },
];

/** Each page's orders (William, 26 Nov 2026): the hired swords' by rating too. */
export const HIRELING_SORTS: Record<HirelingCatalogueKind, SortOption<HirelingSort>[]> = {
  "hired-swords": [
    ...FEES,
    { id: "rating", label: "Rating: low to high" },
    { id: "-rating", label: "Rating: high to low" },
  ],
  "dramatis-personae": FEES,
};

/**
 * A fee's gold (dice left out): none at all is 0, and a fee in a hero's place or in his rules has
 * no gold to compare, so it goes last.
 */
const goldOf = (fee: Fee | undefined) =>
  !fee || fee.kind === "none" ? 0 : fee.kind === "gold" ? (fee.gold ?? 0) : null;

const hire = (entry: HirelingProfile) => goldOf(entry.hire_fee);
const upkeep = (entry: HirelingProfile) => goldOf(entry.upkeep_fee);
const rating = (entry: HirelingProfile) => entry.rating;

const ORDERS: Record<
  Exclude<HirelingSort, "name">,
  (a: HirelingProfile, b: HirelingProfile) => number
> = {
  hire: byNumber(hire),
  "-hire": byNumber(hire, true),
  upkeep: byNumber(upkeep),
  "-upkeep": byNumber(upkeep, true),
  rating: byNumber(rating),
  "-rating": byNumber(rating, true),
};

const BY_NAME = () => 0;

/** Two entries in the order picked, 0 for by name (the rows' tie-break already) or a tie. */
export const hirelingOrder = (sort: HirelingSort) => (sort === "name" ? BY_NAME : ORDERS[sort]);
