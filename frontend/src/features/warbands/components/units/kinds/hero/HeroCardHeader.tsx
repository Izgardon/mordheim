import { useState } from "react";
import { Check, X } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { updateWarbandHero } from "@/features/warbands/api/warbands-api";
import LeaderCrown from "./LeaderCrown";

import type { SummaryHeaderProps } from "../../../../units/unit-slot-types";

/** Hero summary header: name, leader crown, level line and the Trade badge (BUG-31: not gated). */
export default function HeroCardHeader({
  unit: hero,
  warbandId,
  level,
  onUnitUpdated,
}: SummaryHeaderProps<"hero">) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canMarkTraded = hero.trading_action === true;

  const handleConfirmTrade = async () => {
    if (!canMarkTraded || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateWarbandHero(warbandId, hero.id, {
        trading_action: false,
      });
      onUnitUpdated?.(updated);
      setIsConfirmOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const badgeClassName = [
    "self-start shrink-0 rounded-full border px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em]",
    canMarkTraded
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 transition hover:border-emerald-400/70 hover:bg-emerald-500/15"
      : "border-border/40 bg-background/20 text-muted-foreground/70",
  ].join(" ");

  const badgeContent = (
    <span className="inline-flex items-center gap-1">
      {canMarkTraded ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>Trade</span>
    </span>
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3 px-4 pt-2 pb-1">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xl font-bold">
            {hero.name || "Untitled hero"}
            {hero.is_leader ? <LeaderCrown /> : null}
          </p>
          <p className="text-sm text-muted-foreground">
            Level {level} {hero.unit_type || "Hero"}
          </p>
        </div>
        {canMarkTraded ? (
          <button
            type="button"
            className={badgeClassName}
            onClick={() => setIsConfirmOpen(true)}
            disabled={isSubmitting}
            aria-label={`Mark ${hero.name || "hero"} as having used their trading action`}
          >
            {badgeContent}
          </button>
        ) : (
          <span className={badgeClassName}>{badgeContent}</span>
        )}
      </div>
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        description={
          <span>
            Mark <span className="font-semibold text-foreground">{hero.name || "this hero"}</span>{" "}
            as having used their trading action?
          </span>
        }
        confirmText={isSubmitting ? "Marking..." : "Confirm Trade"}
        confirmVariant="default"
        isConfirming={isSubmitting}
        onConfirm={() => {
          void handleConfirmTrade();
        }}
      />
    </>
  );
}
