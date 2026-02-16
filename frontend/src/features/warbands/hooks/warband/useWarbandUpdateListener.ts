import { useEffect, type Dispatch, type SetStateAction } from "react";

import {
  getWarbandSummary,
  listWarbandHeroes,
  listWarbandHiredSwords,
} from "@/features/warbands/api/warbands-api";

import type {
  Warband,
  WarbandHero,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";

type UseWarbandUpdateListenerParams = {
  warbandId?: number | null;
  refreshTradeTotal: (warbandId: number) => Promise<number>;
  setTradeTotal: (value: number) => void;
  setWarband: Dispatch<SetStateAction<Warband | null>>;
  setHeroes: (heroes: WarbandHero[]) => void;
  setHiredSwords: (hiredSwords: WarbandHiredSword[]) => void;
};

export function useWarbandUpdateListener({
  warbandId,
  refreshTradeTotal,
  setTradeTotal,
  setWarband,
  setHeroes,
  setHiredSwords,
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

      refreshTradeTotal(warbandId)
        .then((total) => setTradeTotal(total))
        .catch(() => setTradeTotal(0));

      getWarbandSummary(warbandId)
        .then((summary) =>
          setWarband((current) => (current ? { ...current, ...summary } : current))
        )
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
    };

    window.addEventListener("warband:updated", handleWarbandUpdate);
    return () => {
      window.removeEventListener("warband:updated", handleWarbandUpdate);
    };
  }, [refreshTradeTotal, setHeroes, setHiredSwords, setTradeTotal, setWarband, warbandId]);
}
