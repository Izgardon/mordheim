import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";

import {
  actOnGap,
  takeMemberKit,
  type GapActionBody,
  type LoadoutAnswer,
} from "../../api/warbands-henchmen";
import { sendBackToItem } from "../../api/beasts-api";
import { useWarbandCacheUpdate } from "../../api/warband-cache";
import type { Henchman, HenchmenGroup } from "../../types/warband-types";

/** Where a dismissed member's share of the loadout goes. */
export type ShareChoice = "stash" | "leaves";

/**
 * A group's actions on one member (henchmen loadouts): fill or leave a gap, take his kit to the
 * stash, or send a creature back to the stash as its item, at the price it was bought at (William,
 * 25 Nov 2026; dismissing is the edit form's). Each answer goes into the cached sheet and stash.
 */
export function useGroupLoadout(warbandId: number) {
  const updateCache = useWarbandCacheUpdate();
  const fail = (what: string) => (error: unknown) =>
    toast.error(what, { description: getErrorMessage(error) });
  const apply = (answer: LoadoutAnswer) =>
    updateCache(warbandId, {
      henchmenGroups: [answer.unit],
      summary: answer.summary,
      stashItems: answer.stash_items,
      removedStashItemIds: answer.removed_stash_item_ids,
    });

  const gap = useMutation({
    mutationFn: (vars: { group: HenchmenGroup; gapId: number; body: GapActionBody }) =>
      actOnGap(warbandId, vars.group.id, vars.gapId, vars.body),
    onSuccess: apply,
    onError: fail("Couldn't change their gear."),
  });

  const kit = useMutation({
    mutationFn: (vars: { group: HenchmenGroup; member: Henchman }) =>
      takeMemberKit(warbandId, vars.group.id, vars.member.id),
    onSuccess: apply,
    onError: fail("Couldn't take their kit."),
  });

  const backToItem = useMutation({
    mutationFn: (vars: { group: HenchmenGroup; member: Henchman }) =>
      sendBackToItem(warbandId, vars.group.id, { member_ids: [vars.member.id] }),
    onSuccess: (answer, { group }) =>
      updateCache(warbandId, {
        ...(answer.group
          ? { henchmenGroups: [answer.group] }
          : { removedHenchmenGroupIds: [group.id] }),
        summary: answer.summary,
        stashItems: answer.stash_items,
      }),
    onError: fail("Couldn't send them back to the stash."),
  });

  return {
    actOnGap: (group: HenchmenGroup, gapId: number, body: GapActionBody) =>
      gap.mutate({ group, gapId, body }),
    takeKit: (group: HenchmenGroup, member: Henchman) => kit.mutate({ group, member }),
    backToItem: (group: HenchmenGroup, member: Henchman) => backToItem.mutate({ group, member }),
    busy: gap.isPending || kit.isPending || backToItem.isPending,
  };
}
