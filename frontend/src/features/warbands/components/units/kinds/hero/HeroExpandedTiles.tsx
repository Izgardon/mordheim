import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { updateWarbandHero } from "@/features/warbands/api/warbands-api";
import { calculateUnitTotalPrice } from "../../../../utils/warband-utils";
import {
  CasterTile,
  CostTile,
  SizeTile,
  cardPanelStyle,
  tilePadding,
} from "../../expanded/ExpandedTiles";

import type { ExpandedTilesProps } from "../../../../units/unit-slot-types";

/**
 * Trading Action (a button for editors while it's available: the summary badge is not gated,
 * BUG-31), Size, Caster and Total Cost = base + items.
 */
export default function HeroExpandedTiles({
  unit: hero,
  warbandId,
  layout,
  canEdit,
  onUnitUpdated,
  reportUnitUpdated,
}: ExpandedTilesProps<"hero">) {
  const [isTradeConfirmOpen, setIsTradeConfirmOpen] = useState(false);
  const [isTradeSubmitting, setIsTradeSubmitting] = useState(false);
  const { basePrice, totalPrice } = calculateUnitTotalPrice(hero);
  const padding = tilePadding(layout);

  const handleConfirmTrade = async () => {
    if (isTradeSubmitting) return;
    setIsTradeSubmitting(true);
    try {
      const updated = await updateWarbandHero(warbandId, hero.id, { trading_action: false });
      // Pinned quirk: the update is reported twice (once through onUnitUpdated).
      onUnitUpdated(updated);
      reportUnitUpdated?.(updated);
      setIsTradeConfirmOpen(false);
    } finally {
      setIsTradeSubmitting(false);
    }
  };

  return (
    <>
      {hero.trading_action && canEdit ? (
        <button
          type="button"
          className={`${padding} text-left transition-[filter] duration-150 hover:brightness-125`}
          style={cardPanelStyle}
          onClick={() => setIsTradeConfirmOpen(true)}
          disabled={isTradeSubmitting}
          aria-label={`Mark ${hero.name || "hero"} as having used their trading action`}
        >
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Trading Action
          </span>
          <p className="text-sm font-semibold text-emerald-400">Available</p>
        </button>
      ) : (
        <div className={padding} style={cardPanelStyle}>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Trading Action
          </span>
          <p
            className={`text-sm font-semibold ${hero.trading_action ? "text-emerald-400" : "text-muted-foreground"}`}
          >
            {hero.trading_action ? "Available" : "Spent"}
          </p>
        </div>
      )}
      <SizeTile layout={layout} large={hero.large} />
      <CasterTile layout={layout} caster={hero.caster} spells={hero.spells} />
      <CostTile
        layout={layout}
        label="Total Cost"
        total={totalPrice}
        baseCost={basePrice}
        lines={(hero.items ?? []).map((item) => ({
          key: item.id,
          label: item.name,
          cost: Number(item.cost ?? 0),
        }))}
      />
      <ConfirmDialog
        open={isTradeConfirmOpen}
        onOpenChange={setIsTradeConfirmOpen}
        description={
          <span>
            Mark <span className="font-semibold text-foreground">{hero.name || "this hero"}</span>{" "}
            as having used their trading action?
          </span>
        }
        confirmText={isTradeSubmitting ? "Marking..." : "Confirm Trade"}
        confirmVariant="default"
        isConfirming={isTradeSubmitting}
        onConfirm={() => {
          void handleConfirmTrade();
        }}
      />
    </>
  );
}
