import { useState } from "react";
import { ChevronUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

import type { StoreBasket as Basket } from "./useStoreBasket";

const count = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

function Lines({ basket, isMobile }: { basket: Basket; isMobile: boolean }) {
  return (
    <ul className="flex flex-col">
      {basket.lines.map((line) => (
        <li
          key={line.id}
          className={cn(
            "flex items-center gap-2.5",
            isMobile ? "border-t border-line py-1.5" : "py-1"
          )}
        >
          <span className="min-w-0 flex-1 text-[13px] text-ink">
            <span className="font-bold">{line.item.name}</span>{" "}
            <span className="text-muted-foreground">
              → {line.recipient.label}
              {line.recipient.count > 1 ? ` ×${line.recipient.count}` : ""}
            </span>
          </span>
          {line.free ? (
            <span className="text-xs font-semibold text-good">free</span>
          ) : (
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                inputMode="numeric"
                aria-label={`Price for ${line.item.name}`}
                value={line.price}
                onChange={(event) =>
                  basket.setPrice(line.id, Math.max(0, Math.trunc(Number(event.target.value) || 0)))
                }
                className={cn(
                  "box-border border border-strong bg-page px-1.5 font-mono text-[13px] text-ink",
                  isMobile ? "h-10 w-[68px]" : "h-8 w-[72px]"
                )}
              />
              {line.recipient.count > 1 ? "gc each" : "gc"}
            </label>
          )}
          <IconButton
            aria-label={`Remove ${line.item.name}`}
            className={isMobile ? "h-10 w-10" : "h-8 w-8"}
            onClick={() => basket.remove(line.id)}
          >
            <X aria-hidden="true" />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

/**
 * The store's basket (design E): on the web, the drawer's footer with every line (the item, who
 * gets it, its price editable, Remove), the total and the gold left, and Buy all; on a phone a bar
 * at the bottom of the sheet that opens to list the lines.
 */
export default function StoreBasket({
  basket,
  gold,
  isMobile,
  onBuyAll,
}: {
  basket: Basket;
  gold: number;
  isMobile: boolean;
  onBuyAll: () => void;
}) {
  const [open, setOpen] = useState(true);
  const left = gold - basket.total;
  const empty = basket.lines.length === 0;
  const buy = (
    <Button
      className={isMobile ? "min-h-12 px-[22px] text-[15px]" : "min-h-11 px-5"}
      disabled={empty || basket.buying}
      onClick={onBuyAll}
    >
      {basket.buying ? "Buying…" : "Buy all"}
    </Button>
  );

  if (isMobile) {
    return (
      <div className="-mx-4 -mt-[13px] flex flex-col border-t border-accent-line bg-surface">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-12 items-center justify-between gap-2.5 px-4"
        >
          <span className="text-[13px] font-bold text-ink">
            Basket · {count(basket.lines.length)}
          </span>
          <span className="flex items-center gap-2 text-[13px] text-text2">
            <span className="font-mono font-bold text-head">{basket.total} gc</span>
            <ChevronUp
              className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")}
              aria-hidden="true"
            />
          </span>
        </button>
        {open && !empty ? (
          <div className="px-4 pb-1.5">
            <Lines basket={basket} isMobile />
          </div>
        ) : null}
        <div className="flex items-center gap-2.5 px-4 pb-1 pt-1.5">
          <span className={cn("flex-1 text-[13px]", left < 0 ? "text-danger" : "text-text2")}>
            {left} gc left after
          </span>
          {buy}
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-6 -mb-4 -mt-[17px] flex flex-col gap-2.5 border-t border-accent-line bg-surface px-6 pb-5 pt-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">Basket</span>
        <span className="text-xs text-muted-foreground">{count(basket.lines.length)}</span>
      </div>
      {empty ? (
        <p className="m-0 text-[13px] text-muted-foreground">
          Nothing yet: Get an item and pick who it is for.
        </p>
      ) : (
        <Lines basket={basket} isMobile={false} />
      )}
      <div className="flex items-center gap-3 border-t border-line pt-2.5">
        <span className="flex-1 text-[13px] text-text2">
          Total <span className="font-mono font-bold text-head">{basket.total} gc</span> ·{" "}
          <span className={left < 0 ? "text-danger" : undefined}>{left} gc left</span>
        </span>
        {buy}
      </div>
    </div>
  );
}
