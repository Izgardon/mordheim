import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUnitPatch } from "../../../../hooks/units/useUnitMutations";

import type { WarbandHero } from "../../../../types/warband-types";

const HERO = { key: "hero", listKey: "heroes" } as const;
const TRADE_ERROR = "Unable to mark the trading action.";

/** Marking a hero's trading action as used: the confirm step and its PATCH. */
export function useTradingAction(
  hero: WarbandHero,
  warbandId: number,
  onUnitUpdated?: (updated: WarbandHero) => void
) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const patch = useUnitPatch(HERO, warbandId);

  // A failure stays in the dialog with the server's message (BUG-31: it was an unhandled
  // rejection, so viewers and failed requests got no answer).
  const confirm = () => {
    if (patch.isPending) return;
    patch.mutate(
      { unitId: hero.id, payload: { trading_action: false } },
      {
        onSuccess: (updated) => {
          onUnitUpdated?.(updated);
          setIsConfirmOpen(false);
        },
      }
    );
  };

  return {
    isConfirmOpen,
    setIsConfirmOpen: (open: boolean) => {
      if (!open) patch.reset();
      setIsConfirmOpen(open);
    },
    open: () => {
      patch.reset();
      setIsConfirmOpen(true);
    },
    confirm,
    isSubmitting: patch.isPending,
    error: patch.error ? patch.error.message || TRADE_ERROR : "",
  };
}

export type TradingAction = ReturnType<typeof useTradingAction>;

export function TradeConfirmDialog({ hero, trade }: { hero: WarbandHero; trade: TradingAction }) {
  return (
    <ConfirmDialog
      open={trade.isConfirmOpen}
      onOpenChange={trade.setIsConfirmOpen}
      description={
        <>
          <span>
            Mark <span className="font-semibold text-foreground">{hero.name || "this hero"}</span>{" "}
            as having used their trading action?
          </span>
          {trade.error ? (
            <p role="alert" className="mt-2 text-red-500">
              {trade.error}
            </p>
          ) : null}
        </>
      }
      confirmText={trade.isSubmitting ? "Marking..." : "Confirm Trade"}
      confirmVariant="default"
      isConfirming={trade.isSubmitting}
      onConfirm={trade.confirm}
    />
  );
}
