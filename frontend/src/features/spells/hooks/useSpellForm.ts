import { useCallback, useState } from "react";

import { useCatalogueTypeField } from "@/features/catalogue/hooks/useCatalogueTypeField";
import { bookCampaign } from "@/features/catalogue/api/catalogue-entry-api";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";
import { useCatalogueDelete } from "@/features/catalogue/hooks/useCatalogueDelete";
import { useCatalogueRevert } from "@/features/catalogue/hooks/useCatalogueRevert";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors, type NameMatch } from "@/lib/field-errors";

import { createSpell, updateSpell } from "../api/spells-api";

import type { Spell } from "../types/spell-types";

type SpellFormValues = {
  name: string;
  type: string;
  description: string;
  dc: string;
  roll: string;
  typeCommitted: boolean;
};

type SpellTextField = "name" | "description" | "dc" | "roll";

const valuesOf = (spell: Spell | null): SpellFormValues => ({
  name: spell?.name ?? "",
  type: spell?.type ?? "",
  description: spell?.description ?? "",
  dc: spell?.dc?.toString() ?? "",
  roll: spell?.roll?.toString() ?? "",
  typeCommitted: Boolean(spell),
});

type UseSpellFormOptions = {
  campaignId: number;
  /** The spell being edited; null when adding one. */
  spell: Spell | null;
  typeOptions: readonly string[];
  /** Server field errors clear whenever this changes (the edited spell, or the dialog opening). */
  resetKey: unknown;
  /** Classes added in the form outlast a reset (the warband pages' dialog keeps them). */
  keepAddedTypes?: boolean;
  /** The line for a refusal that says nothing itself. */
  saveFailure?: string;
  /** After a save, its answer already in the cached spells list. */
  onSaved: (spell: Spell) => void;
  /** After a delete, the spell already gone from the cached list. */
  onDeleted?: (spellId: number) => void;
  /** Opens the edit form on an entry a taken name collided with ("Edit this instead"). */
  onEditMatch?: (match: NameMatch) => void;
  /** After a Revert, the book's spell already in the version's place in the cached list. */
  onReverted?: (spell: Spell) => void;
};

/**
 * A spell's Add or Edit form, inline on the Spells page or in the warband pages' dialog: the
 * values, the class ("type") box, the save (trimmed values, difficulty and roll as numbers; the
 * answer goes into the cached list) and the delete (refusals stay in its confirm, BUG-148).
 */
export function useSpellForm({
  campaignId,
  spell,
  typeOptions,
  resetKey,
  keepAddedTypes = false,
  saveFailure = "Unable to save spell",
  onSaved,
  onDeleted,
  onReverted,
  onEditMatch,
}: UseSpellFormOptions) {
  const catalogueCache = useCatalogueCache();
  const [values, setValues] = useState(() => valuesOf(spell));
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(["name"], resetKey);
  const nameTaken = useNameTakenMatches({
    kind: "spells",
    campaignId,
    fieldErrors,
    onEditMatch,
  });
  const deletion = useCatalogueDelete({
    kind: "spells",
    campaignId,
    entry: spell,
    noun: "spell",
    onDeleted,
  });
  const revert = useCatalogueRevert({ kind: "spells", campaignId, entry: spell, onReverted });
  const typeField = useCatalogueTypeField({
    value: values.type,
    onChange: (type, typeCommitted) => setValues((prev) => ({ ...prev, type, typeCommitted })),
    typeOptions,
  });

  const save = async (after?: () => void) => {
    if (!spell && Number.isNaN(campaignId)) {
      setFormError("Unable to create spell.");
      return;
    }
    if (!values.name.trim() || !values.type.trim() || !values.description.trim()) {
      setFormError("Name, type, and description are required.");
      return;
    }
    if (!values.typeCommitted) {
      setFormError("Add or select a type before saving.");
      return;
    }
    const trimmedDc = values.dc.trim();
    // The server stores the difficulty as text: a blank one is "", never null (36333ff).
    const dc: number | "" = trimmedDc ? Number(trimmedDc) : "";
    if (trimmedDc && Number.isNaN(dc)) {
      setFormError("Difficulty must be a number.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    const payload = {
      name: values.name.trim(),
      type: values.type.trim(),
      description: values.description.trim(),
      dc,
      roll: values.roll ? Number(values.roll) : null,
    };
    try {
      // A book spell's first edit makes the campaign's version of it (CAT-TWEAK-01).
      const saved = spell
        ? await updateSpell(spell.id, { ...payload, ...bookCampaign(spell, campaignId) })
        : await createSpell({ ...payload, campaign_id: campaignId });
      catalogueCache.write("spells", campaignId, saved, spell?.id);
      if (spell) {
        // The copies now point at the version, or show the edited entry: sheets read them again.
        void catalogueCache.heldCopiesChanged("spells", campaignId);
      }
      onSaved(saved);
      after?.();
    } catch (errorResponse) {
      setFormError(fieldErrors.take(errorResponse, saveFailure));
    } finally {
      setIsSaving(false);
    }
  };

  const { reset: resetTypeField } = typeField;
  const { clear: clearFieldErrors } = fieldErrors;
  /** Back to `entry`'s values (a blank form for null), with no message. */
  const load = useCallback(
    (entry: Spell | null) => {
      setValues(valuesOf(entry));
      resetTypeField(keepAddedTypes);
      setFormError("");
      clearFieldErrors();
    },
    [clearFieldErrors, keepAddedTypes, resetTypeField]
  );

  return {
    values,
    setValue: (field: SpellTextField, value: string) =>
      setValues((prev) => ({ ...prev, [field]: value })),
    typeField,
    fieldErrors: fieldErrors.errors,
    nameTaken,
    isSaving: isSaving || deletion.isDeleting,
    formError,
    deleteConfirm: deletion.deleteConfirm,
    revert,
    save,
    remove: deletion.remove,
    load,
  };
}

export type SpellFormState = ReturnType<typeof useSpellForm>;
