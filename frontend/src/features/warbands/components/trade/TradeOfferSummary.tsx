import { cn } from "@/lib/utils";
import { offerValue, type DraftOffer } from "@/features/warbands/utils/trade-offer";

import type { TradeOfferItem } from "@/features/warbands/types/trade-request-types";

type TradeOfferSummaryProps = {
  title: string;
  offer: DraftOffer;
  accepted: boolean;
  emptyText: string;
  /** Your own offer: clicking an item takes one copy back (off once you have accepted). */
  onRemoveItem?: (item: TradeOfferItem) => void;
  disabled?: boolean;
};

const ITEM_CLASS = "rounded border border-white/10 bg-white/5 px-2 py-1 text-left text-xs";

/** One side's offer: its value, whether it is accepted, its items and its gold. */
export default function TradeOfferSummary({
  title,
  offer,
  accepted,
  emptyText,
  onRemoveItem,
  disabled = false,
}: TradeOfferSummaryProps) {
  const itemLabel = (item: TradeOfferItem) => (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate">{item.name}</span>
      <span className="text-[0.55rem] text-muted-foreground">x{item.quantity}</span>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className={cn("flex items-center justify-between", onRemoveItem && "gap-3")}>
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {title}
          </p>
          <span className="text-[0.65rem] text-muted-foreground">
            Total value: {offerValue(offer)} gc
          </span>
        </div>
        {accepted ? (
          <span className="surface-inline theme-heading-soft rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em]">
            Accepted
          </span>
        ) : null}
      </div>
      <div className="rounded-xl border border-[#2b2117]/80 bg-[#0f0c09] p-3">
        <div className="grid min-h-[80px] grid-cols-2 gap-2">
          {offer.items.length === 0 ? (
            <span className="text-xs text-muted-foreground">{emptyText}</span>
          ) : (
            offer.items.map((item) =>
              onRemoveItem ? (
                <button
                  key={`${item.id}-${item.quantity}`}
                  type="button"
                  onClick={() => onRemoveItem(item)}
                  disabled={disabled}
                  className={cn(ITEM_CLASS, disabled ? "opacity-50" : "hover:border-white/40")}
                >
                  {itemLabel(item)}
                </button>
              ) : (
                <div key={`${item.id}-${item.quantity}`} className={ITEM_CLASS}>
                  {itemLabel(item)}
                </div>
              )
            )
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Gold</span>
          <span>{offer.gold || 0} gc</span>
        </div>
      </div>
    </div>
  );
}
