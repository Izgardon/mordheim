import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ItemKindIcon } from "@/components/ui/game-icons";
import { ROW_SELECT, SectionedSelect } from "@/components/ui/sectioned-select";
import { SidePanel } from "@/components/ui/side-panel";

import {
  ItemRowButton,
  OwnedItemInfo,
  useShownItem,
  type ShownItem,
} from "@/features/items/components/ItemInfo";
import { itemKind } from "@/features/items/item-kind";
import type { Item } from "@/features/items/types/item-types";
import { useCatalogue } from "@/lib/catalogue-queries";

import { warbandStashQuery } from "../../api/economy-queries";
import { stashKey } from "../../api/warband-cache";
import type { ItemPlace } from "../../hooks/units/useUnitActions";
import { copiesForGroup } from "../../units/loadout";
import { placeOf, unitSections } from "../roster/unit-sections";
import StashMakeHenchmen from "./StashMakeHenchmen";
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
  onMove: (itemId: number, to: ItemPlace, quantity?: number, material?: string) => void;
  onSell: (item: WarbandItemSummary) => void;
  /** Puts a material on a weapon in the stash (weapon materials): silver only. */
};

type StashListProps = Omit<StashPanelProps, "open" | "onOpenChange"> & {
  /** Whether a row's item shows its details at the foot of the panel. */
  isShown: (key: string) => boolean;
  onToggleShown: (next: ShownItem) => void;
};

/** Copies an Equip moves: one, or one for each member of a group (henchmen loadouts). */
function copiesFor(units: RosterUnit[], to: ItemPlace, inStash: number) {
  const target = units.find((entry) => entry.kind === to.type && entry.unit.id === to.id);
  return target && isGroup(target) ? copiesForGroup(target.unit, inStash) : 1;
}

/**
 * The warband's stash (design E): each item with its count and cost, Equip and Sell; a click on an
 * item shows its details at the foot of the panel. A row is one item at one material (weapon
 * materials), so a Gromril Sword sits apart from a plain one and reads as the server names it, and
 * a plain weapon's row offers the material the book lets a warband add later.
 */
export function StashList({
  campaignId,
  warbandId,
  canEdit,
  units,
  forUnit,
  onMove,
  onSell,
  isShown,
  onToggleShown,
}: StashListProps) {
  const stash = useQuery(warbandStashQuery(campaignId, warbandId));
  const items = stash.data ?? [];
  // a stash row names only the item: its kind and its rules come from the cached catalogue
  const catalogue = useCatalogue("items", campaignId).data ?? [];
  const entryOf = (item: WarbandItemSummary): Item =>
    catalogue.find((entry) => entry.id === item.id) ?? {
      id: item.id,
      name: item.name,
      type: "",
      beast_kind: item.beast_kind,
      availabilities: [],
    };
  if (stash.isPending) return <p className="text-sm text-muted-foreground">Opening the stash…</p>;
  if (!items.length) return <p className="text-sm text-text2">The stash is empty.</p>;
  return (
    <ul className="m-0 flex list-none flex-col border-t border-line p-0">
      {items.map((item) => {
        const key = `stash:${stashKey(item)}`;
        const entry = entryOf(item);
        return (
          <li
            key={stashKey(item)}
            className="flex flex-wrap items-center gap-3 border-b border-line py-2.5"
          >
            <ItemRowButton
              shown={isShown(key)}
              onToggle={() => onToggleShown({ key, item: entry })}
            >
              <ItemKindIcon kind={itemKind(entry)} className="h-5 w-5 text-accent-text" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="item-name font-bold text-ink">
                  {item.material_name || item.name}
                  {item.quantity && item.quantity > 1 ? (
                    <span className="ml-1.5 font-mono text-xs text-accent-text">
                      ×{item.quantity}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.cost != null ? `${item.cost} gc each` : "Cost unknown"}
                </span>
              </div>
            </ItemRowButton>
            {canEdit ? (
              <div className="flex items-center gap-1.5">
                {forUnit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const to = { type: forUnit.kind, id: forUnit.unit.id };
                      const copies = copiesFor([forUnit], to, item.quantity ?? 1);
                      onMove(item.id, to, copies, item.material ?? "");
                    }}
                  >
                    Equip
                  </Button>
                ) : (
                  <SectionedSelect
                    {...ROW_SELECT}
                    aria-label={`Equip ${item.material_name || item.name}`}
                    placeholder="Equip…"
                    value=""
                    sections={unitSections(units)}
                    onValueChange={(value) => {
                      const to = placeOf(value);
                      if (to) {
                        onMove(
                          item.id,
                          to,
                          copiesFor(units, to, item.quantity ?? 1),
                          item.material
                        );
                      }
                    }}
                  />
                )}
                <Button size="sm" variant="ghost" onClick={() => onSell(item)}>
                  Sell
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The details of the item a panel's row shows, at the foot of the panel; null for none. A creature
 * in the stash offers Recruit above them.
 */
export function ShownItemDock({
  campaignId,
  warbandId,
  details,
  canEdit = false,
  units = [],
}: {
  campaignId: number;
  warbandId: number;
  details: ReturnType<typeof useShownItem>;
  canEdit?: boolean;
  units?: RosterUnit[];
}) {
  const stash = useQuery(warbandStashQuery(campaignId, warbandId));
  if (!details.shown) return null;
  const { key, item } = details.shown;
  const row = (stash.data ?? []).find((entry) => `stash:${stashKey(entry)}` === key);
  return (
    <OwnedItemInfo
      campaignId={campaignId}
      warbandId={warbandId}
      itemId={item.id}
      fallback={item}
      onClose={details.close}
      actions={
        canEdit && row?.beast_kind === "creature" ? (
          <StashMakeHenchmen
            key={key}
            warbandId={warbandId}
            row={row}
            item={item}
            units={units}
            onDone={details.close}
          />
        ) : null
      }
    />
  );
}

export default function StashPanel({ open, onOpenChange, ...props }: StashPanelProps) {
  const details = useShownItem(open);
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      kicker="Warband"
      title="Stash"
      dock={
        details.shown ? (
          <ShownItemDock
            campaignId={props.campaignId}
            warbandId={props.warbandId}
            details={details}
            canEdit={props.canEdit}
            units={props.units}
          />
        ) : null
      }
    >
      <StashList {...props} isShown={details.isShown} onToggleShown={details.toggle} />
    </SidePanel>
  );
}
