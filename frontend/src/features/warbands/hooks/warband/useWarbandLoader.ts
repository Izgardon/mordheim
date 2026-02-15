import { useCallback, useEffect, useState } from "react";

import { getWarband, getWarbandById, getWarbandSummary } from "@/features/warbands/api/warbands-api";

import type { Warband, WarbandHero, WarbandHiredSword } from "@/features/warbands/types/warband-types";

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
  const [hiredSwords, setHiredSwords] = useState<WarbandHiredSword[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWarband = useCallback(async () => {
    if (!hasCampaignId) {
      setWarband(null);
      setHeroes([]);
      setHiredSwords([]);
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
        setHiredSwords(summary?.hired_swords ?? []);
      } else {
        setHeroes([]);
        setHiredSwords([]);
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
    hiredSwords,
    setHiredSwords,
    isLoading,
    error,
    loadWarband,
  };
}

