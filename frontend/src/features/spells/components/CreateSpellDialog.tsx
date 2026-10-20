import type { ReactNode } from "react";

import { Button } from "@components/button";

import { CatalogueFormDialog } from "@/features/catalogue/components/CatalogueFormDialog";
import { useControllableOpen } from "@/features/catalogue/hooks/useControllableOpen";

import { useSpellForm } from "../hooks/useSpellForm";
import SpellFormFields from "./SpellFormFields";

import type { Spell } from "../types/spell-types";

type CreateSpellDialogProps = {
  campaignId: number;
  onCreated: (spell: Spell) => void;
  typeOptions?: string[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** The warband pages' New spell dialog. */
export default function CreateSpellDialog({
  campaignId,
  onCreated,
  typeOptions = [],
  trigger,
  open,
  onOpenChange,
}: CreateSpellDialogProps) {
  const dialog = useControllableOpen({ open, onOpenChange });
  const form = useSpellForm({
    campaignId,
    spell: null,
    typeOptions,
    resetKey: dialog.open,
    keepAddedTypes: true,
    saveFailure: "Unable to create spell",
    onSaved: onCreated,
  });

  return (
    <CatalogueFormDialog
      form={form}
      dialog={dialog}
      title="Add Spell"
      noun="spell"
      trigger={trigger}
      defaultTrigger={<Button>Add spell</Button>}
      submitLabel="Add spell"
      onReset={() => form.load(null)}
    >
      <SpellFormFields layout="dialog" form={form} />
    </CatalogueFormDialog>
  );
}
