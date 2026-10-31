import { useEffect } from "react";
import type { ReactNode } from "react";

import { Button } from "@components/button";

import { CatalogueFormDialog } from "@/features/catalogue/components/CatalogueFormDialog";
import { useControllableOpen } from "@/features/catalogue/hooks/useControllableOpen";

import { useSpellForm } from "../hooks/useSpellForm";
import SpellFormFields from "./SpellFormFields";

import type { Spell } from "../types/spell-types";

type SpellFormDialogProps = {
  campaignId: number;
  /** The spell being edited (Delete, Revert); none when adding one. */
  spell?: Spell | null;
  typeOptions?: string[];
  canDelete?: boolean;
  onSaved: (spell: Spell) => void;
  onDeleted?: (spellId: number) => void;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** The Spells page's Add spell dialog, and its edit mode. */
export default function SpellFormDialog({
  campaignId,
  spell = null,
  typeOptions = [],
  canDelete = false,
  onSaved,
  onDeleted,
  trigger,
  open,
  onOpenChange,
}: SpellFormDialogProps) {
  const dialog = useControllableOpen({ open, onOpenChange });
  const form = useSpellForm({
    campaignId,
    spell,
    typeOptions,
    resetKey: dialog.open,
    keepAddedTypes: true,
    saveFailure: spell ? "Unable to save spell" : "Unable to create spell",
    onSaved,
    onDeleted,
  });
  const { load } = form;

  useEffect(() => {
    if (dialog.open) load(spell);
  }, [dialog.open, load, spell]);

  return (
    <CatalogueFormDialog
      form={form}
      dialog={dialog}
      editing={spell}
      title={spell ? "Edit Spell" : "Add Spell"}
      noun="spell"
      trigger={trigger}
      defaultTrigger={<Button>{spell ? "Edit spell" : "Add spell"}</Button>}
      submitLabel={spell ? "Save changes" : "Add spell"}
      canDelete={canDelete}
      onReset={() => load(spell)}
    >
      <SpellFormFields layout="dialog" form={form} />
    </CatalogueFormDialog>
  );
}
