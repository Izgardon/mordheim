import type { ReactNode } from "react";

import { Button } from "@components/button";

import { CatalogueFormDialog } from "@/features/catalogue/components/CatalogueFormDialog";
import { useControllableOpen } from "@/features/catalogue/hooks/useControllableOpen";

import { useSpecialForm } from "../hooks/useSpecialForm";
import SpecialFormFields from "./SpecialFormFields";

import type { Special } from "../types/special-types";

type CreateSpecialDialogProps = {
  campaignId: number;
  onCreated: (special: Special) => void;
  typeOptions?: string[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** The warband pages' New special dialog. */
export default function CreateSpecialDialog({
  campaignId,
  onCreated,
  typeOptions = [],
  trigger,
  open,
  onOpenChange,
}: CreateSpecialDialogProps) {
  const dialog = useControllableOpen({ open, onOpenChange });
  const form = useSpecialForm({
    campaignId,
    typeOptions,
    resetKey: dialog.open,
    onSaved: onCreated,
  });

  return (
    <CatalogueFormDialog
      form={form}
      dialog={dialog}
      title="ADD AN ENTRY"
      trigger={trigger}
      defaultTrigger={<Button>Add special</Button>}
      submitLabel="Add entry"
      onReset={form.reset}
    >
      <SpecialFormFields layout="dialog" form={form} />
    </CatalogueFormDialog>
  );
}
