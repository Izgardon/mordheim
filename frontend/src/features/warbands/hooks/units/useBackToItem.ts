import { useMutation } from "@tanstack/react-query";

import { sendBackToItem, type BackToItemBody } from "../../api/beasts-api";
import { useWarbandCacheUpdate } from "../../api/warband-cache";

/**
 * Members of a creature group back to its item, in the stash (one request, no gold): the answer's
 * group (or its removal, once its last members went), the stash rows and the summary go into the
 * cache.
 */
export function useBackToItem(warbandId: number, groupId: number) {
  const updateWarbandCache = useWarbandCacheUpdate();
  return useMutation({
    mutationFn: (body: BackToItemBody) => sendBackToItem(warbandId, groupId, body),
    onSuccess: ({ group, stash_items, summary }) =>
      updateWarbandCache(warbandId, {
        summary,
        stashItems: stash_items,
        ...(group ? { henchmenGroups: [group] } : { removedHenchmenGroupIds: [groupId] }),
      }),
  });
}
