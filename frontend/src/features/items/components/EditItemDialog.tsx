import type { ReactNode } from "react";

import ItemFormDialog from "./ItemFormDialog";

import type { Item } from "../types/item-types";

type EditItemDialogProps = {
  item: Item;
  onUpdated: (item: Item) => void;
  onDeleted: (itemId: number) => void;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};


export default function EditItemDialog({
  item,
  onUpdated,
  onDeleted,
  trigger,
  open: openProp,
  onOpenChange,
}: EditItemDialogProps) {
  return (
    <ItemFormDialog
      mode="edit"
      item={item}
      campaignId={item.campaign_id ?? 0}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
      trigger={trigger}
      open={openProp}
      onOpenChange={onOpenChange}
    />
  );
}
