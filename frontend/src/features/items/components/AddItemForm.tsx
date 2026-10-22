import { useEffect } from "react";

import { CatalogueInlineForm } from "@/features/catalogue/components/CatalogueInlineForm";

import { useItemForm } from "../hooks/useItemForm";
import ItemFormFields from "./ItemFormFields";

import type { NameMatch } from "@/lib/field-errors";
import type { Item } from "../types/item-types";

type AddItemFormProps = {
  campaignId: number;
  onCreated: (item: Item) => void;
  onUpdated?: (item: Item) => void;
  onDeleted?: (itemId: number) => void;
  onCancel: () => void;
  editingItem?: Item | null;
  canDelete?: boolean;
  /** Opens this form on an entry a taken name collided with ("Edit this instead"). */
  onEditMatch?: (match: NameMatch) => void;
};

/** The Wargear page's Add item and Edit form. */
export default function AddItemForm({
  campaignId,
  onCreated,
  onUpdated,
  onDeleted,
  onCancel,
  editingItem,
  canDelete = false,
  onEditMatch,
}: AddItemFormProps) {
  const item = editingItem ?? null;
  const form = useItemForm({
    campaignId,
    item,
    wording: "summary",
    enabled: true,
    resetKey: editingItem,
    onSaved: (saved) => (item ? onUpdated?.(saved) : onCreated(saved)),
    onDeleted,
    onReverted: (reverted: Item) => onUpdated?.(reverted),
    onEditMatch,
  });
  const { load } = form;

  useEffect(() => load(item), [item, load]);

  return (
    <CatalogueInlineForm
      form={form}
      editing={item}
      noun="item"
      canDelete={canDelete}
      onReset={() => load(null)}
      onCancel={onCancel}
    >
      <ItemFormFields layout="inline" form={form} />
    </CatalogueInlineForm>
  );
}
