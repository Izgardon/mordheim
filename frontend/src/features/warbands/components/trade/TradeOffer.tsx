import { ChipLabel } from "@/components/ui/chip";
import { offerValue, type DraftOffer } from "@/features/warbands/utils/trade-offer";

import type { TradeOfferItem } from "@/features/warbands/types/trade-request-types";

/** One side's offer: its items and gold, its value, and whether that side has accepted. */
export default function TradeOffer({
  title,
  offer,
  accepted,
  emptyText,
  onRemoveItem,
}: {
  title: string;
  offer: DraftOffer;
  accepted: boolean;
  emptyText: string;
  /** Your own offer while you haven't accepted: an item takes one copy back. */
  onRemoveItem?: (item: TradeOfferItem) => void;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
          {title}
        </h3>
        {accepted ? <ChipLabel tone="good">Accepted</ChipLabel> : null}
      </div>
      <div className="flex min-h-[40px] flex-wrap gap-1.5">
        {offer.items.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">{emptyText}</span>
        ) : null}
        {offer.items.map((item) => {
          const label = (
            <>
              {item.name}
              <span className="font-mono text-muted-foreground">×{item.quantity}</span>
            </>
          );
          return onRemoveItem ? (
            <button
              key={item.id}
              type="button"
              aria-label={`Take one ${item.name} back`}
              onClick={() => onRemoveItem(item)}
              className="inline-flex min-h-[34px] items-center gap-1.5 border border-border bg-raised px-2.5 text-xs font-bold text-ink hover:border-strong"
            >
              {label}
            </button>
          ) : (
            <span
              key={item.id}
              className="inline-flex min-h-[34px] items-center gap-1.5 border border-border bg-raised px-2.5 text-xs font-bold text-ink"
            >
              {label}
            </span>
          );
        })}
      </div>
      <div className="flex justify-between border-t border-line pt-2 text-[13px] text-text2">
        <span>Gold {offer.gold || 0} gc</span>
        <span className="text-muted-foreground">Worth {offerValue(offer)} gc</span>
      </div>
    </section>
  );
}
