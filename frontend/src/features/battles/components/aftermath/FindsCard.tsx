import { useState } from "react";
import { X } from "lucide-react";

import { NumberInput } from "@/components/ui/number-input";
import { IconButton } from "@/components/ui/icon-button";
import { ItemKindIcon } from "@/components/ui/game-icons";
import { SearchCombobox } from "@/components/ui/search-select";
import { getItemAvailabilityCostLabel } from "@/features/battles/components/postbattle/find-items";
import type { PostbattleDraft } from "@/features/battles/hooks/usePostbattleDraft";
import { useFindItemSearch } from "@/features/battles/hooks/useFindItemSearch";
import { itemKind, itemKindLine } from "@/features/items/item-kind";
import { cn } from "@/lib/utils";

/**
 * Finds (design E's Explore tab): gold crowns and the items found in the battle, kept with the
 * draft and added to the warband (the gold) and the stash (the items) at Ready.
 */
export default function FindsCard({
  campaignId,
  drafting,
  isMobile,
}: {
  campaignId: number;
  drafting: PostbattleDraft;
  isMobile: boolean;
}) {
  const finds = useFindItemSearch({ campaignId, drafting });
  const draft = drafting.draft;
  const stored = draft?.finds.gold_crowns ?? 0;
  const [gold, setGold] = useState<string | null>(null);
  if (!draft) return null;
  const commit = () => {
    if (gold === null) return;
    finds.commitGold(Math.max(0, Math.trunc(Number(gold) || 0)));
    setGold(null);
  };
  const items = finds.catalogue.data;

  return (
    <article className="flex flex-col gap-3 border border-border bg-surface p-[18px]">
      <h2 className="m-0 font-display text-[19px] font-semibold text-head">Finds</h2>
      <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-start")}>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          Gold crowns
          <span className="flex items-center gap-2">
            <NumberInput
              compact
              aria-label="Gold crowns found"
              className="w-28 font-mono"
              value={gold ?? String(stored)}
              onChange={(event) => setGold(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => (event.key === "Enter" ? commit() : undefined)}
            />
            <span className="text-sm font-semibold text-faint">gc</span>
          </span>
        </label>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-bold text-muted-foreground">Items found</span>
          <div onFocus={() => finds.setIsOpen(true)}>
            <SearchCombobox
              label="Search for an item found"
              placeholder="Search items"
              emptyText="No item by that name."
              loading={finds.catalogue.isLoading}
              options={items.map((item) => ({
                id: item.id,
                title: item.name,
                subtitle: `${itemKindLine(item)} · ${getItemAvailabilityCostLabel(item)}`,
                icon: <ItemKindIcon kind={itemKind(item)} className="text-accent-text" />,
              }))}
              onPick={(option) => {
                const item = items.find((entry) => entry.id === option.id);
                if (item) finds.addItem(item);
              }}
            />
          </div>
          {draft.finds.items.length ? (
            <ul className="flex flex-wrap gap-1.5 pt-1">
              {draft.finds.items.map((item, index) => (
                <li
                  key={`${item.item_id}-${index}`}
                  className="flex min-h-9 items-center gap-1 border border-border bg-page pl-3 text-[13px] font-semibold text-ink"
                >
                  {item.name}
                  <IconButton
                    look="plain"
                    aria-label={`Remove ${item.name}`}
                    className="h-8 w-8"
                    onClick={() => finds.removeItem(index)}
                  >
                    <X aria-hidden="true" />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : (
            <span className="pt-1 text-xs text-muted-foreground">No items found yet.</span>
          )}
        </div>
      </div>
    </article>
  );
}
