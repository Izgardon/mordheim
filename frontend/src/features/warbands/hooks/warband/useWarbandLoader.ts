import { useCallback, useEffect, useRef, useState } from "react";

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

type UnitWithId = {
  id: number;
};

const hasSummaryCardData = <T extends UnitWithId>(units: T[]) =>
  units.some(
    (unit) =>
      Object.prototype.hasOwnProperty.call(unit, "xp") ||
      Object.prototype.hasOwnProperty.call(unit, "level_up")
  );

function mergeUnitSnapshots<T extends UnitWithId>(current: T[], incoming?: T[]) {
  if (!incoming) {
    return current;
  }

  if (current.length === 0 || incoming.length === 0) {
    return incoming;
  }

  const currentHasSummaryCardData = hasSummaryCardData(current);
  const incomingHasSummaryCardData = hasSummaryCardData(incoming);

  if (!currentHasSummaryCardData || incomingHasSummaryCardData) {
    return incoming;
  }

  const currentById = new Map(current.map((unit) => [unit.id, unit]));
  return incoming.map((unit) => currentById.get(unit.id) ?? unit);
}

function mergeWarbandSnapshots(current: Warband | null, incoming: Warband | null) {
  if (!incoming) {
    return current;
  }

  if (!current) {
    return incoming;
  }

  return {
    ...current,
    ...incoming,
    heroes: mergeUnitSnapshots(current.heroes ?? [], incoming.heroes),
    hired_swords: mergeUnitSnapshots(current.hired_swords ?? [], incoming.hired_swords),
    henchmen_groups: mergeUnitSnapshots(current.henchmen_groups ?? [], incoming.henchmen_groups),
  };
}

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
  const bootstrapKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const bootstrapKey = `${campaignId}:${resolvedWarbandId ?? "current"}`;

    if (bootstrapKeyRef.current !== bootstrapKey) {
      bootstrapKeyRef.current = bootstrapKey;
      setWarband(initialWarband);
      setHeroes(initialWarband?.heroes ?? []);
      setHiredSwords(initialWarband?.hired_swords ?? []);
      setHenchmenGroups(initialWarband?.henchmen_groups ?? []);
      setIsLoading(hasCampaignId ? !initialWarband : false);
      setError("");
      return;
    }

    if (!initialWarband) {
      return;
    }

    setWarband((current) => mergeWarbandSnapshots(current, initialWarband));
    setHeroes((current) => mergeUnitSnapshots(current, initialWarband.heroes));
    setHiredSwords((current) => mergeUnitSnapshots(current, initialWarband.hired_swords));
    setHenchmenGroups((current) =>
      mergeUnitSnapshots(current, initialWarband.henchmen_groups)
    );
    setIsLoading(false);
    setError("");
  }, [campaignId, hasCampaignId, initialWarband, resolvedWarbandId]);

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

