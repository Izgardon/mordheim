import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import {
  actOnGap,
  takeMemberKit,
  type GapActionBody,
  type LoadoutAnswer,
} from "../../api/warbands-henchmen";
import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { unitApi } from "../../units/unit-api";
import type { Henchman, HenchmenGroup } from "../../types/warband-types";

/** Where a dismissed member's share of the loadout goes. */
export type ShareChoice = "stash" | "leaves";

/**
 * A group's loadout actions on one member (henchmen loadouts): fill or leave a gap, take his kit
 * to the stash, or dismiss him with his share. Each answer goes into the cached sheet and stash.
 */
export function useGroupLoadout(campaignId: number, warbandId: number) {
  const queryClient = useQueryClient();
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
    onError: fail("Couldn't change his gear."),
  });

  const kit = useMutation({
    mutationFn: (vars: { group: HenchmenGroup; member: Henchman }) =>
      takeMemberKit(warbandId, vars.group.id, vars.member.id),
    onSuccess: apply,
    onError: fail("Couldn't take his kit."),
  });

  const dismiss = useMutation({
    mutationFn: ({
      group,
      member,
      share,
    }: {
      group: HenchmenGroup;
      member: Henchman;
      share: ShareChoice;
    }) =>
      unitApi("henchmen_group").batch(warbandId, {
        update: [
          {
            id: group.id,
            updated_at: group.updated_at,
            henchmen: group.henchmen.map((other) =>
              other.id === member.id ? { id: other.id, dismiss: share } : { id: other.id }
            ),
          },
        ],
      } as never),
    onSuccess: (result) => {
      updateCache(warbandId, { henchmenGroups: result.units, summary: result.summary });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.warbandStash(campaignId, warbandId),
      });
    },
    onError: fail("Couldn't dismiss him."),
  });

  return {
    actOnGap: (group: HenchmenGroup, gapId: number, body: GapActionBody) =>
      gap.mutate({ group, gapId, body }),
    takeKit: (group: HenchmenGroup, member: Henchman) => kit.mutate({ group, member }),
    dismiss: (group: HenchmenGroup, member: Henchman, share: ShareChoice) =>
      dismiss.mutate({ group, member, share }),
    busy: gap.isPending || kit.isPending || dismiss.isPending,
  };
}
