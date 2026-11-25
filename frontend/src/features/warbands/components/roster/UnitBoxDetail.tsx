import { useState } from "react";

import type { Item } from "@/features/items/types/item-types";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import type { AdvancePick } from "../../units/unit-api";
import MakeHenchmenSheet, { type BeastCopies } from "./MakeHenchmenSheet";
import PendingPick from "./PendingPick";
import RulesPanel from "./RulesPanel";
import type { Box } from "./unit-boxes";
import { isGroup, type RosterUnit } from "./unit-view";

/** Which box a card has open: its row's key and its place in that row. */
export type OpenBox = { row: string; index: number };

type UnitBoxDetailProps = {
  /** The box opened, and where it sits: the panel starts afresh for each. */
  box: Box;
  open: OpenBox;
  entry: RosterUnit;
  campaignId: number;
  warbandId: number;
  canEdit: boolean;
  /** The other units an item can move to. */
  others: RosterUnit[];
  onClose: () => void;
  onPick: (pick: AdvancePick) => void;
  onMoveItem: (itemId: number, to: ItemPlace, material?: string) => void;
  onSellItem: (itemId: number, price: number, material?: string) => void;
  onBuyAgain: (item: Item) => void;
  /** A mount's Ride / Dismount: the switch the card's badge presses. */
  onRide: (rowId: number, on: boolean) => void;
};

/** A creature's copies on the unit: a group's whole loadout row, else each copy of it he carries. */
export function unitBeastCopies(entry: RosterUnit, item: Item): BeastCopies {
  const group = isGroup(entry);
  return {
    source: { type: entry.kind, id: entry.unit.id, item_id: item.id },
    itemName: item.name,
    beastId: item.bestiary_entry?.id ?? null,
    most: group
      ? (item.carriers ?? 1)
      : entry.unit.items.filter((copy) => copy.id === item.id && !copy.material).length || 1,
    wholeRow: group,
  };
}

/** What an open box shows: an advance's pick list, else its rules and an item's actions. */
export default function UnitBoxDetail(props: UnitBoxDetailProps) {
  const { box, open, entry, canEdit } = props;
  const item = box.item;
  const [making, setMaking] = useState(false);
  if (box.pending && canEdit) {
    return (
      <PendingPick
        key={`${open.row}-${open.index}`}
        campaignId={props.campaignId}
        list={box.pending}
        entry={entry}
        onClose={props.onClose}
        onPick={(pick) => {
          props.onClose();
          props.onPick(pick);
        }}
      />
    );
  }
  const mount = item?.beast_kind === "mount" && item.row_id != null ? item : null;
  const creature = item?.beast_kind === "creature" ? item : null;
  return (
    <>
      <RulesPanel
        // a box of its own: another box's sale price and Sell state never carry over (William, 8 Nov 2026)
        key={`${open.row}:${open.index}:${item?.id ?? box.name}`}
        detail={box}
        onClose={props.onClose}
        itemActions={
          canEdit && item
            ? {
                owner: entry,
                targets: props.others,
                onMove: (to) => {
                  props.onClose();
                  props.onMoveItem(item.id, to, item.material ?? "");
                },
                onSell: (price) => {
                  props.onClose();
                  props.onSellItem(item.id, price, item.material ?? "");
                },
                onBuyAgain: () => props.onBuyAgain(item),
                ride: mount
                  ? {
                      riding: Boolean(mount.companion),
                      onRide: (on) => props.onRide(mount.row_id as number, on),
                    }
                  : undefined,
                onMakeHenchmen: creature ? () => setMaking(true) : undefined,
              }
            : undefined
        }
      />
      {making && creature ? (
        <MakeHenchmenSheet
          key={creature.row_id ?? creature.id}
          open
          onOpenChange={setMaking}
          warbandId={props.warbandId}
          copies={unitBeastCopies(entry, creature)}
          units={props.others}
          onDone={props.onClose}
        />
      ) : null}
    </>
  );
}
