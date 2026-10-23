import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

import type { UnitSingleUseItem } from "../prebattle/prebattle-types";

type BattleSingleUseItemsProps = {
  unitKey: string;
  singleUseItems: UnitSingleUseItem[];
  canUseItems: boolean;
  onUseItem: (item: UnitSingleUseItem) => void;
  getUsedItemCount: (itemId: number) => number;
  activeItemActionKey: string | null;
};

/** A unit's single-use items in battle: how many are used, and Use while any are left. */
export default function BattleSingleUseItems({
  unitKey,
  singleUseItems,
  canUseItems,
  onUseItem,
  getUsedItemCount,
  activeItemActionKey,
}: BattleSingleUseItemsProps) {
  return (
    <section className="battle-inline-panel rounded-md p-2">
      <p className="mb-1.5 text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground">
        Single-use Items
      </p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {singleUseItems.map((item) => {
          const usedCount = getUsedItemCount(item.id);
          const exhausted = usedCount >= item.quantity;
          const actionKey = `${unitKey}:${item.id}`;
          const isUsing = activeItemActionKey === actionKey;
          return (
            <div
              key={`${unitKey}-item-${item.id}`}
              className="battle-metric-box flex items-center justify-between gap-2 rounded px-2 py-1.5"
            >
              <div className="min-w-0">
                {item.description ? (
                  <Tooltip
                    trigger={
                      <p className="cursor-help truncate text-xs font-semibold text-foreground underline decoration-dotted underline-offset-2">
                        {item.name}
                      </p>
                    }
                    content={item.description}
                    maxWidth={280}
                  />
                ) : (
                  <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                )}
                <p className="text-[0.58rem] text-muted-foreground">
                  {usedCount}/{item.quantity} used
                </p>
              </div>
              {canUseItems ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onUseItem(item)}
                  disabled={exhausted || isUsing}
                >
                  {isUsing ? "Using..." : "Use"}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
