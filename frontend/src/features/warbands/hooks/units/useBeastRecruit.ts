import { useMutation } from "@tanstack/react-query";

import { recruitBeasts, type RecruitAnswer, type RecruitBody } from "../../api/beasts-api";
import { useWarbandCacheUpdate, type WarbandUpdate } from "../../api/warband-cache";
import { toastServerWarnings } from "../../utils/server-warnings";

import type { UnitKindKey, UnitListKey } from "../../types/units";
import type { WarbandUnitDetail } from "../../types/warband-types";

const LIST_KEYS: Record<UnitKindKey, UnitListKey> = {
  hero: "heroes",
  henchmen_group: "henchmenGroups",
  hireling: "hirelings",
};

/**
 * What a recruit's answer changes in the cache: the group (new or joined), the unit the copies
 * left or the stash row (or its removal), and the summary (rating, warband size).
 */
export function recruitUpdate(answer: RecruitAnswer, body: RecruitBody): WarbandUpdate {
  const update: WarbandUpdate = {
    summary: answer.summary,
    henchmenGroups: [answer.group],
    stashItems: answer.stash_item ? [answer.stash_item] : undefined,
    removedStashItemIds: answer.removed_stash_item_id ? [answer.removed_stash_item_id] : undefined,
  };
  if (body.source.type !== "stash" && answer.source) {
    const key = LIST_KEYS[body.source.type];
    const units = [...((update[key] as WarbandUnitDetail[] | undefined) ?? []), answer.source];
    Object.assign(update, { [key]: units });
  }
  return update;
}

/**
 * Recruits copies of a creature's Animal item into henchmen in one request (no gold moves); the
 * answer goes into the cached sheet and stash, and its size warnings show as toasts.
 */
export function useBeastRecruit(warbandId: number) {
  const updateWarbandCache = useWarbandCacheUpdate();
  return useMutation({
    mutationFn: (body: RecruitBody) => recruitBeasts(warbandId, body),
    onSuccess: (answer, body) => {
      updateWarbandCache(warbandId, recruitUpdate(answer, body));
      toastServerWarnings(answer.warnings);
    },
  });
}
