import { ItemKindIcon } from "@/components/ui/game-icons";
import { cn } from "@/lib/utils";

import { ItemRowButton, type ShownItem } from "../components/ItemInfo";
import { itemKind } from "../item-kind";
import type { Item, ItemAvailability } from "../types/item-types";
import { isCommon, priceLabel, rarityLabel } from "../utils/item-prices";
import AcquireForm from "./AcquireForm";
import { itemName, kindOf } from "./store-items";
import type { BasketLine, Recipient } from "./useStoreBasket";

/** One offer: the item, the price row the server picked first, the rows it may buy at, why not usually. */
export type StoreOffer = {
  item: Item;
  availability: ItemAvailability;
  rows: ItemAvailability[];
  warning: string;
};

/** What His list adds to a row: his list's name for the item, why it is dimmed, the limit's warning. */
export type HisRowView = { name: string; off: string; limit: string | null };

type StoreRowProps = {
  offer: StoreOffer;
  his: HisRowView | null;
  open: boolean;
  onOpen: (open: boolean) => void;
  canBuy: boolean;
  isMobile: boolean;
  warbandId: number;
  recipients: Recipient[];
  firstKey: string | null;
  searchers: { id: number; name: string; spent: boolean }[];
  /** Buy again's price, for the row it opened. */
  startPrice: number | null;
  /** The bonus a rare search starts on (the variant's: Marienburg +1). */
  rareBonus: number;
  onPick: (line: Omit<BasketLine, "id">) => void;
  isShown: (key: string) => boolean;
  onToggleShown: (next: ShownItem) => void;
};

/**
 * A row of the store (design E): the item's name (on His list, as his list names it), its kind,
 * the price row the server picked, Common or Rare N, the server's reason it isn't usually sold
 * here, and on His list a line he isn't meant to take dimmed with its reason; Get opens its
 * acquire form.
 */
export default function StoreRow({ offer, his, ...props }: StoreRowProps) {
  const { item, availability, rows, warning } = offer;
  const key = `store:${item.id}`;
  const warnings = [warning, his?.off ?? "", his?.limit ?? ""].filter(Boolean);
  return (
    <li className="flex flex-col gap-2.5 border-b border-line py-2.5">
      <div className="flex items-center gap-3">
        <ItemRowButton
          shown={props.isShown(key)}
          onToggle={() => props.onToggleShown({ key, item, availability })}
        >
          <ItemKindIcon
            kind={itemKind(item)}
            className={cn("h-5 w-5 text-accent-text", his?.off && "opacity-60")}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className={cn("item-name font-bold text-ink", his?.off && "opacity-60")}>
              {his?.name ?? itemName(item)}
            </span>
            <span className={cn("text-xs text-muted-foreground", his?.off && "opacity-60")}>
              {props.isMobile ? `${priceLabel(availability)} · ` : `${kindOf(item)}`}
              {props.isMobile ? (
                <span className={!isCommon(availability.rarity) ? "text-accent-text" : ""}>
                  {rarityLabel(availability.rarity)}
                </span>
              ) : null}
            </span>
            {warnings.map((text) => (
              <span key={text} className="text-xs font-semibold text-danger">
                {text}
              </span>
            ))}
          </div>
          {props.isMobile ? null : (
            <div
              className={cn("flex min-w-24 shrink-0 flex-col text-right", his?.off && "opacity-60")}
            >
              <span className="whitespace-nowrap font-mono text-sm font-bold text-head">
                {priceLabel(availability)}
              </span>
              <span
                className={cn(
                  "text-xs",
                  !isCommon(availability.rarity) ? "text-accent-text" : "text-faint"
                )}
              >
                {rarityLabel(availability.rarity)}
              </span>
            </div>
          )}
        </ItemRowButton>
        {props.canBuy ? (
          <button
            type="button"
            aria-expanded={props.open}
            onClick={() => props.onOpen(!props.open)}
            className={cn(
              "shrink-0 border px-3 text-[13px] font-bold",
              props.isMobile ? "min-h-11 min-w-16" : "min-h-10 min-w-[72px]",
              props.open
                ? "border-border bg-transparent text-muted-foreground"
                : "border-accent-line bg-accent-soft text-accent-hi"
            )}
          >
            {props.open ? "Close" : "Get"}
          </button>
        ) : null}
      </div>
      {props.open ? (
        <AcquireForm
          warbandId={props.warbandId}
          item={item}
          rows={rows}
          startPrice={props.startPrice}
          startBonus={props.rareBonus}
          recipients={props.recipients}
          firstKey={props.firstKey}
          searchers={props.searchers}
          isMobile={props.isMobile}
          onPick={props.onPick}
        />
      ) : null}
    </li>
  );
}
