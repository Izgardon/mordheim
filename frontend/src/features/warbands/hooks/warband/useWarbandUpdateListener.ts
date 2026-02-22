import { useEffect, type Dispatch, type SetStateAction } from "react";

import {
  listWarbandHenchmenGroups,
  getWarbandSummary,
  listWarbandHeroes,
  listWarbandHiredSwords,
} from "@/features/warbands/api/warbands-api";

import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";

type UseWarbandUpdateListenerParams = {
  warbandId?: number | null;
  setTradeTotal: (value: number) => void;
  setWarband: Dispatch<SetStateAction<Warband | null>>;
  setHeroes: (heroes: WarbandHero[]) => void;
  setHiredSwords: (hiredSwords: WarbandHiredSword[]) => void;
  setHenchmenGroups: (henchmenGroups: HenchmenGroup[]) => void;
};

export function useWarbandUpdateListener({
  warbandId,
  setTradeTotal,
  setWarband,
  setHeroes,
  setHiredSwords,
  setHenchmenGroups,
}: UseWarbandUpdateListenerParams) {
  useEffect(() => {
    if (!warbandId) {
      return;
    }

    const handleWarbandUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ warbandId?: number }>).detail;
      if (!detail?.warbandId || detail.warbandId !== warbandId) {
        return;
      }

      getWarbandSummary(warbandId)
        .then((summary) => {
          setWarband((current) => (current ? { ...current, ...summary } : current));
          if (summary.gold !== undefined) setTradeTotal(summary.gold);
        })
        .catch(() => {
          /* keep current warband data if refresh fails */
        });

      listWarbandHeroes(warbandId)
        .then((refreshedHeroes) => setHeroes(refreshedHeroes))
        .catch(() => {
          /* keep current heroes if refresh fails */
        });

      listWarbandHiredSwords(warbandId)
        .then((refreshedHiredSwords) => setHiredSwords(refreshedHiredSwords))
        .catch(() => {
          /* keep current hired swords if refresh fails */
        });

      listWarbandHenchmenGroups(warbandId)
        .then((refreshedHenchmenGroups) => setHenchmenGroups(refreshedHenchmenGroups))
        .catch(() => {
          /* keep current henchmen groups if refresh fails */
        });
    };

    window.addEventListener("warband:updated", handleWarbandUpdate);
    return () => {
      window.removeEventListener("warband:updated", handleWarbandUpdate);
    };
  }, [setHenchmenGroups, setHeroes, setHiredSwords, setTradeTotal, setWarband, warbandId]);
}
