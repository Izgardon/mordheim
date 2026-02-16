import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listWarbandHeroes, listWarbandHiredSwords } from "@/features/warbands/api/warbands-api";

import type { WarbandHero, WarbandHiredSword } from "@/features/warbands/types/warband-types";

export type UnitSummaryType = "heroes" | "hiredswords";

type UnitsByType = {
  heroes: WarbandHero[];
  hiredswords: WarbandHiredSword[];
};

type LoadingByType = Record<UnitSummaryType, boolean>;

type UseUnitSummaryListsParams = {
  warbandId?: number | null;
  enabled: boolean;
  unitTypes: UnitSummaryType[];
  activeUnitType?: UnitSummaryType | "";
};

const emptyUnits: UnitsByType = { heroes: [], hiredswords: [] };
const emptyLoading: LoadingByType = { heroes: false, hiredswords: false };

export function useUnitSummaryLists({
  warbandId,
  enabled,
  unitTypes,
  activeUnitType = "",
}: UseUnitSummaryListsParams) {
  const [unitsByType, setUnitsByType] = useState<UnitsByType>(emptyUnits);
  const [loadingByType, setLoadingByType] = useState<LoadingByType>(emptyLoading);
  const [error, setError] = useState("");
  const loadedTypesRef = useRef<Set<UnitSummaryType>>(new Set());
  const prevWarbandIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevWarbandIdRef.current !== warbandId) {
      prevWarbandIdRef.current = warbandId ?? null;
      loadedTypesRef.current = new Set();
      setUnitsByType(emptyUnits);
      setLoadingByType(emptyLoading);
      setError("");
    }
  }, [warbandId]);

  const loadType = useCallback(
    async (type: UnitSummaryType) => {
      if (!warbandId || loadedTypesRef.current.has(type) || loadingByType[type]) {
        return;
      }
      setError("");
      setLoadingByType((prev) => ({ ...prev, [type]: true }));
      try {
        const data =
          type === "heroes"
            ? await listWarbandHeroes(warbandId)
            : await listWarbandHiredSwords(warbandId);
        loadedTypesRef.current.add(type);
        setUnitsByType((prev) => ({ ...prev, [type]: data }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load units.");
      } finally {
        setLoadingByType((prev) => ({ ...prev, [type]: false }));
      }
    },
    [loadingByType, warbandId]
  );

  useEffect(() => {
    if (!enabled || !warbandId || unitTypes.length === 0) {
      return;
    }
    if (activeUnitType && unitTypes.includes(activeUnitType)) {
      void loadType(activeUnitType);
    }
  }, [activeUnitType, enabled, loadType, unitTypes, warbandId]);

  const isLoading = useMemo(
    () => unitTypes.some((type) => loadingByType[type]),
    [loadingByType, unitTypes]
  );

  return { unitsByType, isLoading, error };
}
