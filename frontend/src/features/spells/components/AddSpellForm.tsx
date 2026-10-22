import { useEffect } from "react";

import { CatalogueInlineForm } from "@/features/catalogue/components/CatalogueInlineForm";

import { useSpellForm } from "../hooks/useSpellForm";
import SpellFormFields from "./SpellFormFields";

import type { NameMatch } from "@/lib/field-errors";
import type { Spell } from "../types/spell-types";

type AddSpellFormProps = {
  campaignId: number;
  onCreated: (spell: Spell) => void;
  onUpdated?: (spell: Spell) => void;
  onDeleted?: (spellId: number) => void;
  onCancel: () => void;
  typeOptions?: string[];
  editingSpell?: Spell | null;
  canDelete?: boolean;
  /** Opens this form on an entry a taken name collided with ("Edit this instead"). */
  onEditMatch?: (match: NameMatch) => void;
};

/** The Spells page's Add spell and Edit form. */
export default function AddSpellForm({
  campaignId,
  onCreated,
  onUpdated,
  onDeleted,
  onCancel,
  typeOptions = [],
  editingSpell,
  canDelete = false,
  onEditMatch,
}: AddSpellFormProps) {
  const spell = editingSpell ?? null;
  const form = useSpellForm({
    campaignId,
    spell,
    typeOptions,
    resetKey: editingSpell,
    onSaved: (saved) => (spell ? onUpdated?.(saved) : onCreated(saved)),
    onDeleted,
    onReverted: (reverted: Spell) => onUpdated?.(reverted),
    onEditMatch,
  });
  const { load } = form;

  useEffect(() => load(spell), [load, spell]);

  return (
    <CatalogueInlineForm
      form={form}
      editing={spell}
      noun="spell"
      canDelete={canDelete}
      onReset={() => load(null)}
      onCancel={onCancel}
    >
      <SpellFormFields layout="inline" form={form} />
    </CatalogueInlineForm>
  );
}
