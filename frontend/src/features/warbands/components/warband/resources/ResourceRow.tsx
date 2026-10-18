import { Minus, Plus } from "lucide-react";

import { Button } from "@components/button";

import type { WarbandResource } from "../../../types/warband-types";

export type ResourceBarVariant = "card" | "plain";

type ResourceRowProps = {
  resource: WarbandResource;
  /** The saved amount plus unsent +/- clicks. */
  amount: number;
  isUpdating: boolean;
  canEdit: boolean;
  variant: ResourceBarVariant;
  onAdjust: (resource: WarbandResource, delta: number) => void;
  onSell: (resourceId: number, resourceName: string, maxQuantity: number) => void;
};

// The card's controls appear on hover or focus (ECON-UX-03: PR C shows them on touch too).
const ON_HOVER =
  "opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100";

const ADJUST_CLASS: Record<ResourceBarVariant, Record<"decrease" | "increase", string>> = {
  plain: {
    decrease: "h-7 w-7 rounded-full disabled:cursor-not-allowed",
    increase: "h-7 w-7 rounded-full disabled:cursor-not-allowed",
  },
  card: {
    decrease: `pointer-events-none absolute left-0 top-1/2 h-6 w-6 -translate-x-full -translate-y-1/2 ${ON_HOVER} disabled:cursor-not-allowed`,
    increase: `pointer-events-none absolute right-0 top-1/2 h-6 w-6 translate-x-full -translate-y-1/2 ${ON_HOVER} disabled:cursor-not-allowed`,
  },
};

const CARD_SELL_CLASS = `pointer-events-none absolute left-1/2 top-full mt-0 h-7 -translate-x-1/2 px-3 text-[0.55rem] ${ON_HOVER}`;

/** One resource with its amount, +/- and Sell, in the bar's card or plain (mobile) layout. */
export default function ResourceRow({
  resource,
  amount,
  isUpdating,
  canEdit,
  variant,
  onAdjust,
  onSell,
}: ResourceRowProps) {
  const iconClass = variant === "plain" ? "theme-accent h-3.5 w-3.5" : "theme-accent h-4 w-4";
  const adjust = (direction: "decrease" | "increase") => (
    <Button
      type="button"
      variant="icon"
      size="icon"
      aria-label={`${direction === "decrease" ? "Decrease" : "Increase"} ${resource.name}`}
      onClick={() => onAdjust(resource, direction === "decrease" ? -1 : 1)}
      disabled={isUpdating || !canEdit}
      className={ADJUST_CLASS[variant][direction]}
    >
      {direction === "decrease" ? (
        <Minus aria-hidden="true" className={iconClass} />
      ) : (
        <Plus aria-hidden="true" className={iconClass} />
      )}
    </Button>
  );
  const sell = (className: string) => (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={() => onSell(resource.id, resource.name, amount)}
      disabled={!canEdit}
      className={className}
    >
      Sell
    </Button>
  );

  if (variant === "plain") {
    return (
      <div className="flex h-full flex-col gap-2 rounded-lg border border-border/60 bg-[rgba(18,14,10,0.78)] px-2.5 py-2">
        <div className="min-w-0">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
            {resource.name}
          </p>
        </div>
        <div className="mt-auto flex min-w-0 items-center justify-between gap-1.5">
          <p className="text-base font-semibold text-foreground">{amount}</p>
          <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1">
            {adjust("decrease")}
            {adjust("increase")}
            {sell("h-7 px-2 text-[0.625rem]")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col items-center gap-1 px-4 py-2 text-xs font-semibold text-muted-foreground">
      <span className="max-w-[7rem] truncate text-center uppercase tracking-wide">
        {resource.name}
      </span>
      <div className="relative flex items-center justify-center">
        <div className="surface-inline flex h-12 w-16 items-center justify-center rounded-lg text-base font-bold text-foreground">
          {amount}
        </div>
        {sell(CARD_SELL_CLASS)}
        {adjust("decrease")}
        {adjust("increase")}
      </div>
    </div>
  );
}
