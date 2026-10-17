import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUnitPatch } from "../../../../hooks/units/useUnitMutations";

import type { WarbandHero } from "../../../../types/warband-types";

const HERO = { key: "hero", listKey: "heroes" } as const;

/** Marking a hero's trading action as used: the confirm step and its PATCH. */
export function useTradingAction(
  hero: WarbandHero,
  warbandId: number,
  onUnitUpdated?: (updated: WarbandHero) => void
) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const patch = useUnitPatch(HERO, warbandId);

  const confirm = async () => {
    if (patch.isPending) return;
    const updated = await patch.mutateAsync({
      unitId: hero.id,
      payload: { trading_action: false },
    });
    onUnitUpdated?.(updated);
    setIsConfirmOpen(false);
  };

  return {
    isConfirmOpen,
    setIsConfirmOpen,
    open: () => setIsConfirmOpen(true),
    confirm,
    isSubmitting: patch.isPending,
  };
}

export type TradingAction = ReturnType<typeof useTradingAction>;

export function TradeConfirmDialog({ hero, trade }: { hero: WarbandHero; trade: TradingAction }) {
  return (
    <ConfirmDialog
      open={trade.isConfirmOpen}
      onOpenChange={trade.setIsConfirmOpen}
      description={
        <span>
          Mark <span className="font-semibold text-foreground">{hero.name || "this hero"}</span> as
          having used their trading action?
        </span>
      }
      confirmText={trade.isSubmitting ? "Marking..." : "Confirm Trade"}
      confirmVariant="default"
      isConfirming={trade.isSubmitting}
      onConfirm={() => {
        void trade.confirm();
      }}
    />
  );
}
