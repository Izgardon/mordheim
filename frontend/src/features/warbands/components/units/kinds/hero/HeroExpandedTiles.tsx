import { calculateUnitTotalPrice } from "../../../../utils/warband-utils";
import {
  CasterTile,
  CostTile,
  SizeTile,
  cardPanelStyle,
  tilePadding,
} from "../../expanded/ExpandedTiles";
import { TradeConfirmDialog, useTradingAction } from "./HeroTradeConfirm";

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
  // Pinned quirk (BUG-99): the update is reported twice (once through onUnitUpdated).
  const trade = useTradingAction(hero, warbandId, (updated) => {
    onUnitUpdated(updated);
    reportUnitUpdated?.(updated);
  });
  const { basePrice, totalPrice } = calculateUnitTotalPrice(hero);
  const padding = tilePadding(layout);

  return (
    <>
      {hero.trading_action && canEdit ? (
        <button
          type="button"
          className={`${padding} text-left transition-[filter] duration-150 hover:brightness-125`}
          style={cardPanelStyle}
          onClick={trade.open}
          disabled={trade.isSubmitting}
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
      <TradeConfirmDialog hero={hero} trade={trade} />
    </>
  );
}
