import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";

import { warbandStashQuery } from "../../api/economy-queries";
import type { ItemPlace } from "../../hooks/units/useUnitActions";
import { unitName, type RosterUnit } from "../roster/unit-view";
import type { WarbandItemSummary } from "../../types/warband-types";

type StashPanelProps = {
  campaignId: number;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  /** Who can take an item from the stash. */
  units: RosterUnit[];
  /** When set, Equip goes straight to this unit (the loadout's stash). */
  forUnit?: RosterUnit | null;
  onMove: (itemId: number, to: ItemPlace) => void;
  onSell: (item: WarbandItemSummary) => void;
};

/** The warband's stash (design E): each item with its count and cost, Equip and Sell. */
export function StashList({
  campaignId,
  warbandId,
  canEdit,
  units,
  forUnit,
  onMove,
  onSell,
}: Omit<StashPanelProps, "open" | "onOpenChange">) {
  const stash = useQuery(warbandStashQuery(campaignId, warbandId));
  const items = stash.data ?? [];
  if (stash.isPending) return <p className="text-sm text-muted-foreground">Opening the stash…</p>;
  if (!items.length) return <p className="text-sm text-text2">The stash is empty.</p>;
  return (
    <ul className="m-0 flex list-none flex-col border-t border-line p-0">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2.5">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-bold text-ink">
              {item.name}
              {item.quantity && item.quantity > 1 ? (
                <span className="ml-1.5 font-mono text-xs text-accent-text">×{item.quantity}</span>
              ) : null}
            </span>
            <span className="text-xs text-muted-foreground">
              {item.cost != null ? `${item.cost} gc each` : "Cost unknown"}
            </span>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-1.5">
              {forUnit ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onMove(item.id, { type: forUnit.kind, id: forUnit.unit.id })}
                >
                  Equip
                </Button>
              ) : (
                <select
                  aria-label={`Equip ${item.name}`}
                  value=""
                  onChange={(event) => {
                    const [type, id] = event.target.value.split(":");
                    if (type) onMove(item.id, { type: type as ItemPlace["type"], id: Number(id) });
                  }}
                  className="h-8 border border-strong bg-page px-2 text-xs text-ink"
                >
                  <option value="">Equip…</option>
                  {units.map((entry) => (
                    <option
                      key={`${entry.kind}-${entry.unit.id}`}
                      value={`${entry.kind}:${entry.unit.id}`}
                    >
                      {unitName(entry.unit)}
                    </option>
                  ))}
                </select>
              )}
              <Button size="sm" variant="ghost" onClick={() => onSell(item)}>
                Sell
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function StashPanel({ open, onOpenChange, ...props }: StashPanelProps) {
  return (
    <SidePanel open={open} onOpenChange={onOpenChange} kicker="Warband" title="Stash">
      <StashList {...props} />
    </SidePanel>
  );
}
