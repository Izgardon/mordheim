import type { Item } from "@/features/items/types/item-types";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import type { AdvancePick } from "../../units/unit-api";
import PendingPick from "./PendingPick";
import RulesPanel from "./RulesPanel";
import type { Box } from "./unit-boxes";
import type { RosterUnit } from "./unit-view";

/** Which box a card has open: its row's key and its place in that row. */
export type OpenBox = { row: string; index: number };

type UnitBoxDetailProps = {
  /** The box opened, and where it sits: the panel starts afresh for each. */
  box: Box;
  open: OpenBox;
  entry: RosterUnit;
  campaignId: number;
  canEdit: boolean;
  /** The other units an item can move to. */
  others: RosterUnit[];
  onClose: () => void;
  onPick: (pick: AdvancePick) => void;
  onMoveItem: (itemId: number, to: ItemPlace, material?: string) => void;
  onSellItem: (itemId: number, price: number, material?: string) => void;
  onBuyAgain: (item: Item) => void;
};

/** What an open box shows: an advance's pick list, else its rules and an item's actions. */
export default function UnitBoxDetail(props: UnitBoxDetailProps) {
  const { box, open, entry, canEdit } = props;
  const item = box.item;
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
  return (
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
            }
          : undefined
      }
    />
  );
}
