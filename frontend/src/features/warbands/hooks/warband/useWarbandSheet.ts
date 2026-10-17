import { useMemo, useRef } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  splitWarbandPatch,
  warbandBaseQuery,
  warbandSummaryQuery,
  warbandUnitsQuery,
} from "../../api/warband-queries";

import type { Unit, UnitKindKey } from "../../types/units";
import type { Warband, WarbandUnitsSummary } from "../../types/warband-types";

type UseWarbandSheetOptions = {
  campaignId: number;
  hasCampaignId: boolean;
  /** Someone else's warband (`/warbands/:id`); null for your own. */
  warbandId: number | null;
};

type UnitsUpdate<K extends UnitKindKey> = Unit<K>[] | ((current: Unit<K>[]) => Unit<K>[]);
export type WarbandUnitSetters = { [K in UnitKindKey]: (update: UnitsUpdate<K>) => void };

const NO_HEROES: Unit<"hero">[] = [];
const NO_GROUPS: Unit<"henchmen_group">[] = [];
const NO_HIRED_SWORDS: Unit<"hired_sword">[] = [];

const LOAD_ERROR = "Unable to load warband";
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message || LOAD_ERROR : LOAD_ERROR;

type Visit = { key: string; loaded: boolean; seen: Map<string, { data: number; error: number }> };

/**
 * The warband page's data: the warband merged with its summary, and the three unit lists.
 * Every visit shows the skeleton until that visit's reads land, as the old loader did; after
 * that, refetches update the page in place and a failed refetch keeps what is shown.
 */
export function useWarbandSheet({ campaignId, hasCampaignId, warbandId }: UseWarbandSheetOptions) {
  const queryClient = useQueryClient();
  const invalidError = !hasCampaignId
    ? ""
    : Number.isNaN(campaignId)
      ? "Invalid campaign id."
      : warbandId !== null && Number.isNaN(warbandId)
        ? "Invalid warband id."
        : "";
  const canLoad = hasCampaignId && !invalidError;

  // Re-render on every result, not only on data changes: the visit below counts results.
  const watch = {
    notifyOnChangeProps: ["data", "error", "dataUpdatedAt", "errorUpdatedAt"],
  } satisfies Pick<UseQueryOptions, "notifyOnChangeProps">;
  const base = useQuery({
    ...warbandBaseQuery(campaignId, warbandId),
    enabled: canLoad,
    ...watch,
  });
  const id = canLoad ? (base.data?.id ?? null) : null;
  const partsEnabled = id !== null;
  const parts = { enabled: partsEnabled, ...watch };
  const summary = useQuery({ ...warbandSummaryQuery(campaignId, id ?? 0), ...parts });
  const heroes = useQuery({ ...warbandUnitsQuery(campaignId, id ?? 0, "hero"), ...parts });
  const groups = useQuery({
    ...warbandUnitsQuery(campaignId, id ?? 0, "henchmen_group"),
    ...parts,
  });
  const hiredSwords = useQuery({
    ...warbandUnitsQuery(campaignId, id ?? 0, "hired_sword"),
    ...parts,
  });

  // One visit per page target. A read has landed for the visit once its query has had a result
  // since the visit first saw it; the visit is loaded once the warband read and, if it found a
  // warband, the four part reads have landed without an error.
  const sheetKey = `${campaignId}:${warbandId ?? "mine"}`;
  const visit = useRef<Visit | null>(null);
  if (visit.current?.key !== sheetKey) {
    visit.current = { key: sheetKey, loaded: false, seen: new Map() };
  }
  const { seen } = visit.current;
  const readState = (queryKey: QueryKey) => {
    const state = queryClient.getQueryCache().find({ queryKey, exact: true })?.state;
    const counts = { data: state?.dataUpdateCount ?? 0, error: state?.errorUpdateCount ?? 0 };
    const hash = JSON.stringify(queryKey);
    const before = seen.get(hash) ?? counts;
    seen.set(hash, before);
    return {
      landed: counts.data > before.data || counts.error > before.error,
      failed: counts.error > before.error && state?.status === "error",
    };
  };
  const baseRead = readState(warbandBaseQuery(campaignId, warbandId).queryKey);
  // Every key is read on every render, so a part landing before the warband read still counts.
  const partReads =
    id !== null
      ? [
          readState(queryKeys.campaign.warbandSummary(campaignId, id)),
          ...(["hero", "henchmen_group", "hired_sword"] as const).map((kind) =>
            readState(queryKeys.campaign.warbandUnits(campaignId, id, kind))
          ),
        ]
      : [];
  const required = baseRead.landed && partsEnabled ? [baseRead, ...partReads] : [baseRead];
  const failedIndex = required.findIndex((read) => read.failed);
  const failedQuery = [base, summary, heroes, groups, hiredSwords][failedIndex];
  if (canLoad && !visit.current.loaded && failedIndex === -1 && required.every((r) => r.landed)) {
    visit.current.loaded = true;
  }
  const isLoaded = visit.current.loaded;
  const failed = failedIndex === -1 ? null : failedQuery;

  const baseData = canLoad ? (base.data ?? null) : null;
  const summaryData = summary.data;
  const warband = useMemo(
    () => (baseData ? { ...baseData, ...summaryData } : null),
    [baseData, summaryData]
  );

  const writers = useMemo(() => {
    const baseKey = warbandBaseQuery(campaignId, warbandId).queryKey;
    const unitsSetter =
      <K extends UnitKindKey>(kind: K) =>
      (update: UnitsUpdate<K>) => {
        if (id === null) return;
        queryClient.setQueryData<Unit<K>[]>(
          queryKeys.campaign.warbandUnits(campaignId, id, kind),
          (current: Unit<K>[] | undefined) =>
            typeof update === "function" ? update(current ?? []) : update
        );
      };
    const setUnits: WarbandUnitSetters = {
      hero: unitsSetter("hero"),
      henchmen_group: unitsSetter("henchmen_group"),
      hired_sword: unitsSetter("hired_sword"),
    };
    /** Merges a patch into the shown warband (warband fields and summary fields alike). */
    const mergeWarband = (patch: Partial<Warband>) => {
      const split = splitWarbandPatch(patch);
      queryClient.setQueryData(baseKey, (current: Warband | null | undefined) =>
        current ? { ...current, ...split.warband } : (patch as Warband)
      );
      const targetId = id ?? patch.id;
      if (targetId && Object.keys(split.summary).length > 0) {
        queryClient.setQueryData<WarbandUnitsSummary>(
          queryKeys.campaign.warbandSummary(campaignId, targetId),
          (current: WarbandUnitsSummary | undefined) => ({ ...current, ...split.summary })
        );
      }
    };
    /** A warband just created on this page: it, its summary and empty unit lists. */
    const showCreated = (created: Warband, createdSummary: WarbandUnitsSummary) => {
      queryClient.setQueryData(queryKeys.campaign.warbandSummary(campaignId, created.id), {
        ...createdSummary,
      });
      for (const kind of ["hero", "henchmen_group", "hired_sword"] as const) {
        queryClient.setQueryData(queryKeys.campaign.warbandUnits(campaignId, created.id, kind), []);
      }
      queryClient.setQueryData(baseKey, created);
    };
    return { setUnits, mergeWarband, showCreated };
  }, [campaignId, id, queryClient, warbandId]);

  return {
    warband,
    heroes: (partsEnabled && heroes.data) || NO_HEROES,
    henchmenGroups: (partsEnabled && groups.data) || NO_GROUPS,
    hiredSwords: (partsEnabled && hiredSwords.data) || NO_HIRED_SWORDS,
    isLoading: canLoad && !isLoaded && !failed,
    error: invalidError || (!isLoaded && failed ? messageOf(failed.error) : ""),
    ...writers,
  };
}
