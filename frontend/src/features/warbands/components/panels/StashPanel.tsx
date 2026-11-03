import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ItemKindIcon } from "@/components/ui/game-icons";
import { ROW_SELECT, SectionedSelect } from "@/components/ui/sectioned-select";
import { SidePanel } from "@/components/ui/side-panel";

import { itemKind } from "@/features/items/item-kind";
import { useCatalogue } from "@/lib/catalogue-queries";

import { warbandStashQuery } from "../../api/economy-queries";
import type { ItemPlace } from "../../hooks/units/useUnitActions";
import { copiesForGroup } from "../../units/loadout";
import { placeOf, unitSections } from "../roster/unit-sections";
import { isGroup, type RosterUnit } from "../roster/unit-view";
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
  /** `quantity`: a group takes one copy for each member, up to what the stash holds. */
  onMove: (itemId: number, to: ItemPlace, quantity?: number) => void;
  onSell: (item: WarbandItemSummary) => void;
};

/** Copies an Equip moves: one, or one for each member of a group (henchmen loadouts). */
function copiesFor(units: RosterUnit[], to: ItemPlace, inStash: number) {
  const target = units.find((entry) => entry.kind === to.type && entry.unit.id === to.id);
  return target && isGroup(target) ? copiesForGroup(target.unit, inStash) : 1;
}

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
  // a stash row names only the item: its kind (for the icon) comes from the cached catalogue
  const catalogue = useCatalogue("items", campaignId).data ?? [];
  const kindOf = (item: WarbandItemSummary) =>
    itemKind(
      catalogue.find((entry) => entry.id === item.id) ?? { type: "", beast_kind: item.beast_kind }
    );
  if (stash.isPending) return <p className="text-sm text-muted-foreground">Opening the stash…</p>;
  if (!items.length) return <p className="text-sm text-text2">The stash is empty.</p>;
  return (
    <ul className="m-0 flex list-none flex-col border-t border-line p-0">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2.5">
          <ItemKindIcon kind={kindOf(item)} className="h-5 w-5 text-accent-text" />
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
                  onClick={() => {
                    const to = { type: forUnit.kind, id: forUnit.unit.id };
                    onMove(item.id, to, copiesFor([forUnit], to, item.quantity ?? 1));
                  }}
                >
                  Equip
                </Button>
              ) : (
                <SectionedSelect
                  {...ROW_SELECT}
                  aria-label={`Equip ${item.name}`}
                  placeholder="Equip…"
                  value=""
                  sections={unitSections(units)}
                  onValueChange={(value) => {
                    const to = placeOf(value);
                    if (to) onMove(item.id, to, copiesFor(units, to, item.quantity ?? 1));
                  }}
                />
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
