import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  mergeSheetWarband,
  myWarbandQuery,
  splitWarbandPatch,
  warbandSheetQuery,
} from "../../api/warband-queries";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@/stores/app-store";

import type { WarbandSheet } from "../../types/warband-sheet";
import type { Warband } from "../../types/warband-types";

const LOAD_ERROR = "Unable to load warband";
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message || LOAD_ERROR : LOAD_ERROR;

/**
 * The app store's `warband` (your warband in the campaign, merged with its summary) read from
 * the sheet entry the warband page shares, so a visit to the page costs no extra request.
 */
export function useMyWarbandStore(campaignId: number | null) {
  const { setWarband, setWarbandLoading, setWarbandError } = useAppStore();
  const mine = useQuery({ ...myWarbandQuery(campaignId ?? 0), enabled: campaignId !== null });
  const warbandId = campaignId !== null ? (mine.data?.id ?? null) : null;
  const sheet = useQuery({
    ...warbandSheetQuery(campaignId ?? 0, warbandId ?? 0),
    enabled: warbandId !== null,
  });

  // Unit-row writes leave the sheet's warband and summary untouched, so the store keeps its value.
  const sheetBody = warbandId !== null ? sheet.data?.warband : undefined;
  const sheetSummary = warbandId !== null ? sheet.data?.summary : undefined;
  const merged = useMemo(
    () => (sheetBody && sheetSummary ? { ...sheetBody, ...sheetSummary } : null),
    [sheetBody, sheetSummary]
  );

  const mineData = mine.data;
  const isMinePending = mine.isPending;
  const mineError = mine.data === undefined ? mine.error : null;
  const sheetError = merged === null && warbandId !== null ? sheet.error : null;
  useEffect(() => {
    if (campaignId === null) {
      setWarband(null);
      setWarbandError("");
      setWarbandLoading(false);
      return;
    }
    const error = mineError ? messageOf(mineError) : sheetError ? messageOf(sheetError) : "";
    setWarbandError(error);
    if (mineData === null) {
      setWarband(null);
    } else if (merged) {
      setWarband(merged);
    }
    const isLoading =
      !error && (isMinePending || (mineData !== null && mineData !== undefined && !merged));
    setWarbandLoading(isLoading);
  }, [
    campaignId,
    isMinePending,
    merged,
    mineData,
    mineError,
    setWarband,
    setWarbandError,
    setWarbandLoading,
    sheetError,
  ]);
}

/**
 * Writes to your warband made outside the warband page (settings): they go into the cache the
 * store follows, so `useMyWarbandStore` stays the store's only writer.
 */
export function useMyWarbandWriter(campaignId: number | null) {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      merge: (warbandId: number, patch: Partial<Warband>) => {
        if (campaignId === null) return;
        const { warband } = splitWarbandPatch(patch);
        queryClient.setQueryData<Warband | null>(
          queryKeys.campaign.myWarband(campaignId),
          (current: Warband | null | undefined) =>
            current && current.id === warbandId ? { ...current, ...warband } : current
        );
        queryClient.setQueryData<WarbandSheet>(
          queryKeys.campaign.warbandSheet(campaignId, warbandId),
          (sheet: WarbandSheet | undefined) => sheet && mergeSheetWarband(sheet, patch)
        );
      },
      remove: (warbandId: number) => {
        if (campaignId === null) return;
        queryClient.setQueryData(queryKeys.campaign.myWarband(campaignId), null);
        queryClient.removeQueries({ queryKey: queryKeys.campaign.warband(campaignId, warbandId) });
      },
    }),
    [campaignId, queryClient]
  );
}
