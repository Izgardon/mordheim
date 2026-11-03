import { useId, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { FactLine } from "@/features/reference/ReferenceDetail";
import { useCatalogue } from "@/lib/catalogue-queries";
import { cn } from "@/lib/utils";

import { useWhoCan } from "../api/who-can-queries";
import { itemName, kindOf } from "../store/store-items";
import type { Item, ItemAvailability } from "../types/item-types";
import ItemRules, { itemFacts } from "./ItemRules";

type ItemInfoProps = {
  item: Item;
  /** The price row whose cost and rarity it shows (the one the warband sees). */
  availability: ItemAvailability | null;
  onClose: () => void;
};

/**
 * An item's details at the foot of the store, the stash or a loadout: its figures, price and
 * rarity, and its rules with their summaries and D6 tables as its Wargear card reads them, without
 * the flavour.
 */
export default function ItemInfo({ item, availability, onClose }: ItemInfoProps) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3
            id={heading}
            className="m-0 font-display text-lg font-semibold leading-tight text-head"
          >
            {itemName(item)}
          </h3>
          {kindOf(item) ? (
            <span className="text-xs text-muted-foreground">{kindOf(item)}</span>
          ) : null}
        </div>
        <IconButton aria-label="Close details" look="plain" className="h-8 w-8" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      <FactLine facts={itemFacts(item, availability)} />
      <ItemRules item={item} />
    </section>
  );
}

/** The catalogue's entry for an item id: its own row, else the campaign's version replacing it. */
const entryFor = (catalogue: Item[], itemId: number) =>
  catalogue.find((entry) => entry.id === itemId) ??
  catalogue.find((entry) => entry.replaces === itemId);

/**
 * `ItemInfo` for an item the warband holds (the stash, a loadout): the catalogue's entry and the
 * price row the server picks for the warband, else `fallback` (the copy it holds).
 */
export function OwnedItemInfo({
  campaignId,
  warbandId,
  itemId,
  fallback,
  onClose,
}: {
  campaignId: number;
  warbandId: number;
  itemId: number;
  fallback: Item;
  onClose: () => void;
}) {
  const catalogue = useCatalogue("items", campaignId).data;
  const whoCan = useWhoCan(campaignId, warbandId);
  const item = entryFor(catalogue, itemId) ?? fallback;
  const rows = item.availabilities ?? [];
  const offer = whoCan.items.get(item.id);
  const row = rows.find((entry) => entry.id === offer?.availability_id) ?? rows[0] ?? null;
  return <ItemInfo item={item} availability={row} onClose={onClose} />;
}

/** A list row's item part (its icon, name and figures): a click shows its details, again hides them. */
export function ItemRowButton({
  shown,
  onToggle,
  children,
}: {
  shown: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={shown}
      onClick={onToggle}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        shown && "[&_.item-name]:text-accent-hi"
      )}
    >
      {children}
    </button>
  );
}

/**
 * The item a panel shows: its row's key (one row at a time), the item that row holds and, in the
 * store, the price row the warband sees.
 */
export type ShownItem = { key: string; item: Item; availability?: ItemAvailability | null };

/**
 * Which item's details a panel shows: a row's click shows it, the same row's click hides it and
 * another row's switches to it; none each time the panel opens (`session` turns true, or to
 * another unit's key).
 */
export function useShownItem(session: boolean | string) {
  const [shown, setShown] = useState<ShownItem | null>(null);
  const [last, setLast] = useState(session);
  if (session !== last) {
    setLast(session);
    if (session) setShown(null);
  }
  return {
    shown,
    isShown: (key: string) => shown?.key === key,
    toggle: (next: ShownItem) => setShown(shown?.key === next.key ? null : next),
    close: () => setShown(null),
  };
}
