import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { myWarbandQuery, warbandSheetQuery } from "../../api/warband-queries";
import { useAppStore } from "@/stores/app-store";

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
