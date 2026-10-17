import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getWarband, getWarbandSheet } from "./warbands-api";

import type { WarbandSheet } from "../types/warband-sheet";
import type { Warband, WarbandUnitsSummary } from "../types/warband-types";

/*
 * The warband page's server state: one `GET warbands/<id>/sheet/` entry per warband, plus the
 * campaign's warband list that resolves "my warband" to an id. Both use the client's default
 * staleness: a cached sheet shows at once and revalidates in the background when stale.
 */

/** Your warband in the campaign (the list endpoint's first row), or null. */
export const myWarbandQuery = (campaignId: number) =>
  queryOptions({
    queryKey: queryKeys.campaign.myWarband(campaignId),
    queryFn: (): Promise<Warband | null> => getWarband(campaignId),
  });

export const warbandSheetQuery = (campaignId: number, warbandId: number) =>
  queryOptions({
    queryKey: queryKeys.campaign.warbandSheet(campaignId, warbandId),
    queryFn: (): Promise<WarbandSheet> => getWarbandSheet(warbandId),
  });

/** The page's warband: the warband body with the summary's gold, rating and lists over it. */
export const sheetWarband = (sheet: WarbandSheet): Warband => ({
  ...sheet.warband,
  ...sheet.summary,
});

/** Summary fields live in the sheet's summary, the rest in its warband (see `mergeSheetWarband`). */
const SUMMARY_FIELDS = [
  "resources",
  "rating",
  "gold",
  "heroes",
  "hired_swords",
  "henchmen_groups",
  // The roster counts (decision 12): a saved summary must not be shadowed by the stale one.
  "unit_count",
  "max_units",
  "hero_count",
  "max_heroes",
  "hired_sword_count",
  "max_hired_swords",
] as const satisfies readonly (keyof WarbandUnitsSummary & keyof Warband)[];

/** Splits a warband patch into its warband part and its summary part. */
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

/** Merges a warband patch (warband and summary fields alike) into a cached sheet. */
export function mergeSheetWarband(sheet: WarbandSheet, patch: Partial<Warband>): WarbandSheet {
  const split = splitWarbandPatch(patch);
  return {
    ...sheet,
    warband: { ...sheet.warband, ...split.warband },
    summary: Object.keys(split.summary).length
      ? { ...sheet.summary, ...split.summary }
      : sheet.summary,
  };
}
