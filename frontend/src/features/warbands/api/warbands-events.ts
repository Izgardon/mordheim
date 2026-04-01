import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
  WarbandItemSummary,
  WarbandUnitsSummary,
} from "../types/warband-types";

export type WarbandUpdateDetail = {
  warbandId: number;
  summary?: WarbandUnitsSummary;
  heroes?: WarbandHero[];
  hiredSwords?: WarbandHiredSword[];
  henchmenGroups?: HenchmenGroup[];
  stashItems?: WarbandItemSummary[];
  removedHeroIds?: number[];
  removedHiredSwordIds?: number[];
  removedHenchmenGroupIds?: number[];
  removedStashItemIds?: number[];
};

export type WarbandUpdateOptions = {
  emitUpdate?: boolean;
};

export function emitWarbandUpdate(
  warbandId: number,
  detail: Omit<WarbandUpdateDetail, "warbandId"> = {}
) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<WarbandUpdateDetail>("warband:updated", {
      detail: { warbandId, ...detail },
    })
  );
}
