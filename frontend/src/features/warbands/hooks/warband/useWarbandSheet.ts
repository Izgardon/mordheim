import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  mergeSheetWarband,
  myWarbandQuery,
  sheetWarband,
  warbandSheetQuery,
} from "../../api/warband-queries";

import type { Unit, UnitKindKey } from "../../types/units";
import { readCapabilities, type WarbandSheet } from "../../types/warband-sheet";
import type { Warband } from "../../types/warband-types";

type UseWarbandSheetOptions = {
  campaignId: number;
  hasCampaignId: boolean;
  /** Someone else's warband (`/warbands/:id`); null for your own. */
  warbandId: number | null;
};

type UnitsUpdate<K extends UnitKindKey> = Unit<K>[] | ((current: Unit<K>[]) => Unit<K>[]);
export type WarbandUnitSetters = { [K in UnitKindKey]: (update: UnitsUpdate<K>) => void };

const COLLECTIONS = {
  hero: "heroes",
  henchmen_group: "henchmen_groups",
  hired_sword: "hired_swords",
} as const satisfies Record<UnitKindKey, keyof WarbandSheet>;

const NO_HEROES: Unit<"hero">[] = [];
const NO_GROUPS: Unit<"henchmen_group">[] = [];
const NO_HIRED_SWORDS: Unit<"hired_sword">[] = [];

const LOAD_ERROR = "Unable to load warband";
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message || LOAD_ERROR : LOAD_ERROR;

/**
 * The warband page's data from one `sheet/` entry: the warband merged with its summary, the
 * capabilities and the three unit lists (detail shape). A cached sheet shows at once and
 * revalidates in the background; a failed refetch keeps what is shown.
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

  const mine = useQuery({ ...myWarbandQuery(campaignId), enabled: canLoad && warbandId === null });
  const id = !canLoad ? null : (warbandId ?? mine.data?.id ?? null);
  const sheet = useQuery({ ...warbandSheetQuery(campaignId, id ?? 0), enabled: id !== null });
  const data = id !== null ? sheet.data : undefined;

  const warband = useMemo(() => (data ? sheetWarband(data) : null), [data]);
  const rawCapabilities = data?.capabilities;
  const capabilities = useMemo(() => readCapabilities(rawCapabilities), [rawCapabilities]);
  const mineFailed = warbandId === null && mine.isError && mine.data === undefined;
  const sheetFailed = id !== null && sheet.isError && data === undefined;
  const isLoading =
    canLoad &&
    !mineFailed &&
    !sheetFailed &&
    ((warbandId === null && mine.isPending) || (id !== null && data === undefined));
  const loadError = mineFailed ? mine.error : sheetFailed ? sheet.error : null;

  const writers = useMemo(() => {
    const updateSheet = (update: (current: WarbandSheet) => WarbandSheet) => {
      if (id === null) return;
      queryClient.setQueryData<WarbandSheet>(
        queryKeys.campaign.warbandSheet(campaignId, id),
        (current: WarbandSheet | undefined) => (current ? update(current) : current)
      );
    };
    const unitsSetter =
      <K extends UnitKindKey>(kind: K) =>
      (update: UnitsUpdate<K>) =>
        updateSheet((current) => {
          const units = current[COLLECTIONS[kind]] as Unit<K>[];
          return {
            ...current,
            [COLLECTIONS[kind]]: typeof update === "function" ? update(units) : update,
          };
        });
    const setUnits: WarbandUnitSetters = {
      hero: unitsSetter("hero"),
      henchmen_group: unitsSetter("henchmen_group"),
      hired_sword: unitsSetter("hired_sword"),
    };
    /** Merges a patch into the shown warband (warband fields and summary fields alike). */
    const mergeWarband = (patch: Partial<Warband>) =>
      updateSheet((current) => mergeSheetWarband(current, patch));
    /** A warband just created on this page: load its sheet, then show it as yours. */
    const showCreated = async (created: Warband) => {
      await queryClient.prefetchQuery(warbandSheetQuery(campaignId, created.id));
      queryClient.setQueryData(queryKeys.campaign.myWarband(campaignId), created);
    };
    return { setUnits, mergeWarband, showCreated };
  }, [campaignId, id, queryClient]);

  return {
    warband,
    /** What the viewer may do, from the server; all false until the sheet has loaded. */
    capabilities,
    heroes: data?.heroes ?? NO_HEROES,
    henchmenGroups: data?.henchmen_groups ?? NO_GROUPS,
    hiredSwords: data?.hired_swords ?? NO_HIRED_SWORDS,
    isLoading,
    error: invalidError || (loadError ? messageOf(loadError) : ""),
    ...writers,
  };
}
