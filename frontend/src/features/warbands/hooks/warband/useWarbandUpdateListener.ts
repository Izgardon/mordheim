import { useEffect, type Dispatch, type SetStateAction } from "react";

import { getWarbandSummary } from "@/features/warbands/api/warbands-api";
import type { WarbandUpdateDetail } from "@/features/warbands/api/warbands-events";

import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHiredSword,
  WarbandItemSummary,
} from "@/features/warbands/types/warband-types";

type UseWarbandUpdateListenerParams = {
  warbandId?: number | null;
  setTradeTotal: (value: number) => void;
  setWarband: Dispatch<SetStateAction<Warband | null>>;
  setHeroes: Dispatch<SetStateAction<WarbandHero[]>>;
  setHiredSwords: Dispatch<SetStateAction<WarbandHiredSword[]>>;
  setHenchmenGroups: Dispatch<SetStateAction<HenchmenGroup[]>>;
  setWarchestItems: Dispatch<SetStateAction<WarbandItemSummary[]>>;
};

function mergeById<T extends { id: number }>(
  current: T[],
  incoming?: T[],
  removedIds?: number[]
) {
  if (!incoming && !removedIds?.length) {
    return current;
  }
  const removed = new Set(removedIds ?? []);
  const next = current.filter((entry) => !removed.has(entry.id));
  const byId = new Map(next.map((entry) => [entry.id, entry]));
  for (const entry of incoming ?? []) {
    byId.set(entry.id, { ...(byId.get(entry.id) ?? {}), ...entry });
  }
  return Array.from(byId.values());
}

export function useWarbandUpdateListener({
  warbandId,
  setTradeTotal,
  setWarband,
  setHeroes,
  setHiredSwords,
  setHenchmenGroups,
  setWarchestItems,
}: UseWarbandUpdateListenerParams) {
  useEffect(() => {
    if (!warbandId) {
      return;
    }

    const handleWarbandUpdate = (event: Event) => {
      const detail = (event as CustomEvent<WarbandUpdateDetail>).detail;
      if (!detail?.warbandId || detail.warbandId !== warbandId) {
        return;
      }

      if (detail.summary) {
        setWarband((current) => (current ? { ...current, ...detail.summary } : current));
        if (detail.summary.gold !== undefined) {
          setTradeTotal(detail.summary.gold);
        }
      }

      if (detail.heroes || detail.removedHeroIds?.length) {
        setHeroes((current) => mergeById(current, detail.heroes, detail.removedHeroIds));
      }

      if (detail.hiredSwords || detail.removedHiredSwordIds?.length) {
        setHiredSwords((current) =>
          mergeById(current, detail.hiredSwords, detail.removedHiredSwordIds)
        );
      }

      if (detail.henchmenGroups || detail.removedHenchmenGroupIds?.length) {
        setHenchmenGroups((current) =>
          mergeById(current, detail.henchmenGroups, detail.removedHenchmenGroupIds)
        );
      }

      if (detail.stashItems || detail.removedStashItemIds?.length) {
        setWarchestItems((current) =>
          mergeById(current, detail.stashItems, detail.removedStashItemIds)
        );
      }

      if (!detail.summary) {
        getWarbandSummary(warbandId)
          .then((summary) => {
            setWarband((current) => (current ? { ...current, ...summary } : current));
            if (summary.gold !== undefined) setTradeTotal(summary.gold);
          })
          .catch(() => {
            /* keep current state if refresh fails */
          });
      }
    };

    window.addEventListener("warband:updated", handleWarbandUpdate);
    return () => {
      window.removeEventListener("warband:updated", handleWarbandUpdate);
    };
  }, [
    setHenchmenGroups,
    setHeroes,
    setHiredSwords,
    setTradeTotal,
    setWarband,
    setWarchestItems,
    warbandId,
  ]);
}
