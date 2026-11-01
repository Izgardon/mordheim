import { useState } from "react";
import { Search, X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { getItemAvailabilityCostLabel } from "@/features/battles/components/postbattle/find-items";
import type { PostbattleDraft } from "@/features/battles/hooks/usePostbattleDraft";
import { useFindItemSearch } from "@/features/battles/hooks/useFindItemSearch";
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
  const showing = finds.isOpen && finds.search.trim() !== "";

  return (
    <article className="flex flex-col gap-3 border border-border bg-surface p-[18px]">
      <h2 className="m-0 font-display text-[19px] font-semibold text-head">Finds</h2>
      <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-start")}>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          Gold crowns
          <span className="flex items-center gap-2">
            <Input
              inputMode="numeric"
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
          <label className="flex min-h-11 items-center gap-2 border border-strong bg-page px-3 text-muted-foreground">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search for an item found"
              placeholder="Search items"
              value={finds.search}
              onFocus={() => finds.setIsOpen(true)}
              onChange={(event) => {
                finds.setSearch(event.target.value);
                finds.setIsOpen(true);
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            />
          </label>
          {showing ? (
            <ul className="flex max-h-56 flex-col overflow-y-auto border border-border bg-panel">
              {finds.catalogue.isLoading ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">Reading the items…</li>
              ) : finds.results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No item by that name.</li>
              ) : (
                finds.results.slice(0, 8).map((item) => (
                  <li key={item.id} className="border-t border-line first:border-t-0">
                    <button
                      type="button"
                      onClick={() => finds.addItem(item)}
                      className="flex min-h-10 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-raised"
                    >
                      <span className="font-semibold text-ink">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {getItemAvailabilityCostLabel(item)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
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
