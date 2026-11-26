import { useMutation } from "@tanstack/react-query";

import { recruitBeasts, type RecruitAnswer, type RecruitBody } from "../../api/beasts-api";
import { useWarbandCacheUpdate, type WarbandUpdate } from "../../api/warband-cache";
import type { HenchmenGroup, WarbandHero, WarbandHireling } from "../../types/warband-types";
import { toastServerWarnings } from "../../utils/server-warnings";

/**
 * The cached sheet and stash after a recruit: the group (new or joined), the unit the copies left
 * (its detail) or the stash row left (or gone), and the summary.
 */
export function recruitUpdate(body: RecruitBody, answer: RecruitAnswer): WarbandUpdate {
  const from = body.source.type;
  const update: WarbandUpdate = {
    summary: answer.summary,
    henchmenGroups: [answer.group],
    stashItems: answer.stash_item ? [answer.stash_item] : undefined,
    removedStashRows: answer.removed_stash_item_id
      ? [{ id: answer.removed_stash_item_id, material: "" }]
      : undefined,
  };
  if (answer.source && from === "hero") update.heroes = [answer.source as WarbandHero];
  if (answer.source && from === "hireling") update.hirelings = [answer.source as WarbandHireling];
  if (answer.source && from === "henchmen_group") {
    update.henchmenGroups = [answer.group, answer.source as HenchmenGroup];
  }
  return update;
}

/** Recruit: copies of a creature's item, from a unit or the stash, become a group's members. */
export function useRecruitBeasts(warbandId: number) {
  const updateCache = useWarbandCacheUpdate();
  return useMutation({
    mutationFn: (body: RecruitBody) => recruitBeasts(warbandId, body),
    onSuccess: (answer, body) => {
      updateCache(warbandId, recruitUpdate(body, answer));
      toastServerWarnings(answer.warnings);
    },
  });
}
