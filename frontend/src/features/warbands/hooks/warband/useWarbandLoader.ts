import { useCallback, useEffect, useState } from "react";

import {
  getWarband,
  getWarbandById,
  getWarbandSummary,
  listWarbandHenchmenGroups,
  listWarbandHeroes,
  listWarbandHiredSwords,
} from "@/features/warbands/api/warbands-api";

import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";

type UseWarbandLoaderParams = {
  campaignId: number;
  hasCampaignId: boolean;
  resolvedWarbandId: number | null;
  initialWarband?: Warband | null;
};

export function useWarbandLoader({
  campaignId,
  hasCampaignId,
  resolvedWarbandId,
  initialWarband = null,
}: UseWarbandLoaderParams) {
  const [warband, setWarband] = useState<Warband | null>(initialWarband);
  const [heroes, setHeroes] = useState<WarbandHero[]>(initialWarband?.heroes ?? []);
  const [hiredSwords, setHiredSwords] = useState<WarbandHiredSword[]>(
    initialWarband?.hired_swords ?? []
  );
  const [henchmenGroups, setHenchmenGroups] = useState<HenchmenGroup[]>(
    initialWarband?.henchmen_groups ?? []
  );
  const [isLoading, setIsLoading] = useState(!initialWarband);
  const [error, setError] = useState("");

  useEffect(() => {
    setWarband(initialWarband);
    setHeroes(initialWarband?.heroes ?? []);
    setHiredSwords(initialWarband?.hired_swords ?? []);
    setHenchmenGroups(initialWarband?.henchmen_groups ?? []);
    setIsLoading(hasCampaignId ? !initialWarband : false);
    setError("");
  }, [hasCampaignId, initialWarband]);

  const loadWarband = useCallback(async () => {
    if (!hasCampaignId) {
      setWarband(null);
      setHeroes([]);
      setHiredSwords([]);
      setHenchmenGroups([]);
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
      if (data?.id) {
        const [summary, heroesData, hiredData, henchmenData] = await Promise.all([
          getWarbandSummary(data.id),
          listWarbandHeroes(data.id),
          listWarbandHiredSwords(data.id),
          listWarbandHenchmenGroups(data.id),
        ]);
        setWarband({ ...data, ...summary });
        setHeroes(heroesData ?? []);
        setHiredSwords(hiredData ?? []);
        setHenchmenGroups(henchmenData ?? []);
      } else {
        setWarband(data);
        setHeroes([]);
        setHiredSwords([]);
        setHenchmenGroups([]);
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
    henchmenGroups,
    setHenchmenGroups,
    isLoading,
    error,
    loadWarband,
  };
}

