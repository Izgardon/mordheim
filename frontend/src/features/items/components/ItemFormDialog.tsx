import { useEffect } from "react";
import type { ReactNode } from "react";

import { Button } from "@components/button";

import {
  CatalogueFormDialog,
  editEntryTrigger,
} from "@/features/catalogue/components/CatalogueFormDialog";
import { useControllableOpen } from "@/features/catalogue/hooks/useControllableOpen";

import { useItemForm } from "../hooks/useItemForm";
import { useItemFormMode } from "../hooks/useItemFormMode";
import { hidesAnError } from "../utils/item-form-mode";
import ItemFormFields from "./ItemFormFields";
import ItemFormModeToggle from "./ItemFormModeToggle";

import type { Item } from "../types/item-types";

type ItemFormDialogBaseProps = {
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ItemFormDialogCreateProps = ItemFormDialogBaseProps & {
  mode: "create";
  campaignId: number;
  onCreated: (item: Item) => void;
};

type ItemFormDialogEditProps = ItemFormDialogBaseProps & {
  mode: "edit";
  item: Item;
  campaignId: number;
  onUpdated: (item: Item) => void;
  onDeleted: (itemId: number) => void;
  canDelete?: boolean;
};

type ItemFormDialogProps = ItemFormDialogCreateProps | ItemFormDialogEditProps;

/**
 * The warband pages' Add item dialog (and an edit mode, with Delete), in Simple or Advanced. A
 * refusal under a field Simple hides shows Advanced, so it is never out of sight.
 */
export default function ItemFormDialog(props: ItemFormDialogProps) {
  const { mode, trigger } = props;
  const item = props.mode === "edit" ? props.item : null;
  const dialog = useControllableOpen(props);
  const form = useItemForm({
    campaignId: props.campaignId,
    item,
    enabled: dialog.open,
    resetKey: dialog.open,
    onSaved: (saved) => (props.mode === "create" ? props.onCreated(saved) : props.onUpdated(saved)),
    onDeleted: props.mode === "edit" ? props.onDeleted : undefined,
  });
  const { load } = form;
  const view = useItemFormMode(item, dialog.open);
  const shown = hidesAnError(form.fieldErrors) ? "advanced" : view.mode;

  useEffect(() => {
    if (item && dialog.open) {
      load(item);
    }
  }, [dialog.open, item, load]);

  return (
    <CatalogueFormDialog
      form={form}
      dialog={dialog}
      editing={item}
      title={mode === "create" ? "Add Wargear" : "Edit Wargear"}
      headerAside={<ItemFormModeToggle mode={shown} onChange={view.choose} />}
      noun="item"
      trigger={trigger}
      defaultTrigger={mode === "create" ? <Button>Add item</Button> : editEntryTrigger("Edit item")}
      submitLabel={mode === "create" ? "Add item" : "Save changes"}
      canDelete={props.mode === "edit" && props.canDelete}
      onReset={() => load(item)}
    >
      <ItemFormFields form={form} idSuffix={`-${mode}`} advanced={shown === "advanced"} />
    </CatalogueFormDialog>
  );
}
