import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  getWarband,
  getWarbandById,
  getWarbandSummary,
  listWarbandHenchmenGroups,
  listWarbandHeroes,
  listWarbandHiredSwords,
} from "./warbands-api";

import type { Unit, UnitKindKey } from "../types/units";
import type { Warband, WarbandUnitsSummary } from "../types/warband-types";

/*
 * The warband page's server state: the warband, its summary and the three unit lists, five
 * reads over today's endpoints. `useWarbandSheet` is the only reader and the helpers below the
 * only writers, so moving to one `GET warbands/<id>/sheet/` later changes this file and
 * `useWarbandSheet`, not the page.
 */

/**
 * Like the loader they replace: every visit to the page refetches, and nothing refetches on
 * window focus or reconnect (an open edit form keeps the lists it started from).
 */
const SHEET_READS = {
  refetchOnMount: "always",
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/** The page's warband: your own (`warbandId` null) or someone else's. */
export const warbandBaseQuery = (campaignId: number, warbandId: number | null) =>
  queryOptions({
    queryKey:
      warbandId === null
        ? queryKeys.campaign.myWarband(campaignId)
        : queryKeys.campaign.warbandDetail(campaignId, warbandId),
    queryFn: (): Promise<Warband | null> =>
      warbandId === null ? getWarband(campaignId) : getWarbandById(warbandId),
    ...SHEET_READS,
  });

export const myWarbandQuery = (campaignId: number) => warbandBaseQuery(campaignId, null);

export const warbandSummaryQuery = (campaignId: number, warbandId: number) =>
  queryOptions({
    queryKey: queryKeys.campaign.warbandSummary(campaignId, warbandId),
    queryFn: (): Promise<WarbandUnitsSummary> => getWarbandSummary(warbandId),
    ...SHEET_READS,
  });

// Looked up per call, so modules that only read the warband needn't load the list endpoints.
const unitLists = (): { [K in UnitKindKey]: (warbandId: number) => Promise<Unit<K>[]> } => ({
  hero: listWarbandHeroes,
  henchmen_group: listWarbandHenchmenGroups,
  hired_sword: listWarbandHiredSwords,
});

export const warbandUnitsQuery = <K extends UnitKindKey>(
  campaignId: number,
  warbandId: number,
  kind: K
) =>
  queryOptions({
    queryKey: queryKeys.campaign.warbandUnits(campaignId, warbandId, kind),
    queryFn: async (): Promise<Unit<K>[]> => (await unitLists()[kind](warbandId)) ?? [],
    ...SHEET_READS,
  });

/** Summary fields live in the summary entry, the rest in the warband entry (see `mergeWarband`). */
const SUMMARY_FIELDS = [
  "resources",
  "rating",
  "gold",
  "heroes",
  "hired_swords",
  "henchmen_groups",
] as const satisfies readonly (keyof WarbandUnitsSummary & keyof Warband)[];

/** Splits a warband patch into its warband-entry part and its summary-entry part. */
export function splitWarbandPatch(patch: Partial<Warband>) {
  const warband: Partial<Warband> = { ...patch };
  const summary: WarbandUnitsSummary = {};
  for (const field of SUMMARY_FIELDS) {
    if (field in patch) {
      Object.assign(summary, { [field]: patch[field] });
      delete warband[field];
    }
  }
  return { warband, summary };
}
