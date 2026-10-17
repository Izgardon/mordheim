import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { myWarbandQuery, warbandSummaryQuery } from "../../api/warband-queries";
import { useAppStore } from "@/stores/app-store";

const LOAD_ERROR = "Unable to load warband";
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message || LOAD_ERROR : LOAD_ERROR;

/**
 * The app store's `warband` (your warband in the campaign, merged with its summary) read from
 * the cache the warband page shares. The layout loads the summary once per warband; it is
 * observed, not refetched, so only an open warband page refreshes it after a write.
 */
export function useMyWarbandStore(campaignId: number | null) {
  const { setWarband, setWarbandLoading, setWarbandError } = useAppStore();
  const queryClient = useQueryClient();
  const mine = useQuery({ ...myWarbandQuery(campaignId ?? 0), enabled: campaignId !== null });
  const warbandId = campaignId !== null ? (mine.data?.id ?? null) : null;
  const summary = useQuery({
    ...warbandSummaryQuery(campaignId ?? 0, warbandId ?? 0),
    enabled: false,
  });
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    setSummaryError("");
    if (campaignId === null || warbandId === null) {
      return;
    }
    let active = true;
    queryClient.fetchQuery(warbandSummaryQuery(campaignId, warbandId)).catch((error) => {
      if (active) setSummaryError(messageOf(error));
    });
    return () => {
      active = false;
    };
  }, [campaignId, queryClient, warbandId]);

  const mineData = mine.data;
  const summaryData = summary.data;
  const isMinePending = mine.isPending;
  const mineError = mine.error;
  useEffect(() => {
    if (campaignId === null) {
      setWarband(null);
      setWarbandError("");
      setWarbandLoading(false);
      return;
    }
    const error = mineError ? messageOf(mineError) : summaryError;
    setWarbandError(error);
    if (mineData === null) {
      setWarband(null);
    } else if (mineData && summaryData) {
      setWarband({ ...mineData, ...summaryData });
    }
    const isLoading =
      !error && (isMinePending || (mineData !== null && mineData !== undefined && !summaryData));
    setWarbandLoading(isLoading);
  }, [
    campaignId,
    isMinePending,
    mineData,
    mineError,
    setWarband,
    setWarbandError,
    setWarbandLoading,
    summaryData,
    summaryError,
  ]);
}
