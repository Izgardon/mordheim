import { useCallback, useEffect, useState } from "react";

import { getWarband, getWarbandById, getWarbandSummary } from "../api/warbands-api";

import type { Warband, WarbandHero } from "../types/warband-types";

type UseWarbandLoaderParams = {
  campaignId: number;
  hasCampaignId: boolean;
  resolvedWarbandId: number | null;
};

export function useWarbandLoader({
  campaignId,
  hasCampaignId,
  resolvedWarbandId,
}: UseWarbandLoaderParams) {
  const [warband, setWarband] = useState<Warband | null>(null);
  const [heroes, setHeroes] = useState<WarbandHero[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWarband = useCallback(async () => {
    if (!hasCampaignId) {
      setWarband(null);
      setHeroes([]);
      setIsLoading(false);
      return;
    }

    if (Number.isNaN(campaignId)) {
      setError("Invalid campaign id.");
      setIsLoading(false);
      return;
    }

    if (resolvedWarbandId !== null && Number.isNaN(resolvedWarbandId)) {
      setError("Invalid warband id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const data =
        resolvedWarbandId !== null
          ? await getWarbandById(resolvedWarbandId)
          : await getWarband(campaignId);
      setWarband(data);
      if (data?.id) {
        const summary = await getWarbandSummary(data.id);
        setHeroes(summary?.heroes ?? []);
      } else {
        setHeroes([]);
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to load warband");
      } else {
        setError("Unable to load warband");
      }
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, hasCampaignId, resolvedWarbandId]);

  useEffect(() => {
    loadWarband();
  }, [loadWarband]);

  return {
    warband,
    setWarband,
    heroes,
    setHeroes,
    isLoading,
    error,
    loadWarband,
  };
}
