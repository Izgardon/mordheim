import { useCallback, useMemo, useState } from "react";

import { resolveFindItemCost } from "@/features/battles/components/postbattle/find-items";
import {
  addPostbattleFindItem,
  removePostbattleFindItem,
  setPostbattleFindsGold,
} from "@/features/battles/components/postbattle/postbattle-utils";
import type { PostbattleDraft } from "@/features/battles/hooks/usePostbattleDraft";
import type { Item } from "@/features/items/types/item-types";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";

/**
 * Postbattle finds: gold crowns and found items. The picker filters the campaign's cached item
 * catalogue (loaded when it first opens, shared with the warband pages): no request per
 * keystroke (PERF-40).
 */
export function useFindItemSearch({
  campaignId,
  drafting,
}: {
  campaignId: number;
  drafting: PostbattleDraft;
}) {
  const { draft, persistDraft, setDraftError } = drafting;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const catalogue = useCatalogue("items", campaignId, { enabled: isOpen });
  const results = useMemo(
    () => catalogue.data.filter((item) => matchesSearchQuery(search, item.name)),
    [catalogue.data, search]
  );

  const addItem = useCallback(
    (item: Item) => {
      if (!draft) {
        return;
      }
      const baseCost = resolveFindItemCost(item);
      if (baseCost === null) {
        setDraftError(`${item.name} does not have an available cost and cannot be added to Finds.`);
        return;
      }
      void persistDraft(
        addPostbattleFindItem(draft, {
          item_id: item.id,
          name: item.name,
          type: item.type || null,
          cost: baseCost,
        })
      );
      setSearch("");
      setIsOpen(false);
    },
    [draft, persistDraft, setDraftError]
  );

  const removeItem = useCallback(
    (index: number) => {
      if (draft) {
        void persistDraft(removePostbattleFindItem(draft, index));
      }
    },
    [draft, persistDraft]
  );

  const commitGold = useCallback(
    (goldCrowns: number) => {
      if (draft && draft.finds.gold_crowns !== goldCrowns) {
        void persistDraft(setPostbattleFindsGold(draft, goldCrowns));
      }
    },
    [draft, persistDraft]
  );

  return {
    isOpen,
    setIsOpen,
    search,
    setSearch,
    catalogue,
    results,
    addItem,
    removeItem,
    commitGold,
  };
}

export type FindItemSearch = ReturnType<typeof useFindItemSearch>;
