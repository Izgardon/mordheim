import { useId, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { FactLine } from "@/features/reference/ReferenceDetail";
import { useCatalogue } from "@/lib/catalogue-queries";
import { cn } from "@/lib/utils";

import { useWhoCan } from "../api/who-can-queries";
import { itemSubtype } from "../item-kind";
import { itemName } from "../store/store-items";
import type { Item, ItemAvailability } from "../types/item-types";
import ItemRules, { itemFacts } from "./ItemRules";

type ItemInfoProps = {
  item: Item;
  /** The price row whose cost and rarity it shows (the one the warband sees). */
  availability: ItemAvailability | null;
  onClose: () => void;
  /** What the warband can do with the copy it holds, above the details (Make henchmen). */
  actions?: ReactNode;
};

/**
 * An item's details at the foot of the store, the stash or a loadout: its figures, price and
 * rarity, who may buy it when not everyone may (the server's words), and its rules with their
 * summaries and D6 tables as its Wargear card reads them, without the flavour. Its header closes
 * it, as the X does (William, 22 Nov 2026).
 */
export default function ItemInfo({ item, availability, onClose, actions }: ItemInfoProps) {
  const heading = useId();
  const who = availability?.who_text ?? "";
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="m-0 font-display text-lg font-semibold leading-tight text-head">
            <button
              type="button"
              aria-label={`Close ${itemName(item)}`}
              onClick={onClose}
              className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span id={heading}>{itemName(item)}</span>
            </button>
          </h3>
          <span className="text-xs text-muted-foreground">{itemSubtype(item)}</span>
        </div>
        <IconButton aria-label="Close details" look="plain" className="h-8 w-8" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      {actions}
      <FactLine facts={itemFacts(item, availability)} />
      {who ? <p className="m-0 text-[13px] font-semibold text-ink">{who}</p> : null}
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
  actions,
}: {
  campaignId: number;
  warbandId: number;
  itemId: number;
  fallback: Item;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const catalogue = useCatalogue("items", campaignId).data;
  const whoCan = useWhoCan(campaignId, warbandId);
  const item = entryFor(catalogue, itemId) ?? fallback;
  const rows = item.availabilities ?? [];
  const offer = whoCan.items.get(item.id);
  const row = rows.find((entry) => entry.id === offer?.availability_id) ?? rows[0] ?? null;
  return <ItemInfo item={item} availability={row} onClose={onClose} actions={actions} />;
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
