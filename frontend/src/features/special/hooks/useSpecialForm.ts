import { useCallback, useState } from "react";

import type { SpecialCategory, SpecialKind } from "@/components/ui/game-icons";
import { useDirtySince } from "@/components/ui/discard-changes";
import {
  prebattlePayload,
  prebattleValuesOf,
  type PrebattleRollValues,
} from "@/features/catalogue/components/PrebattleRollFields";
import { bookCampaign } from "@/features/catalogue/api/catalogue-entry-api";
import { useCatalogueDelete } from "@/features/catalogue/hooks/useCatalogueDelete";
import { useCatalogueRevert } from "@/features/catalogue/hooks/useCatalogueRevert";
import { useCatalogueTypeField } from "@/features/catalogue/hooks/useCatalogueTypeField";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors } from "@/lib/field-errors";

import { createSpecial, updateSpecial } from "../api/special-api";
import type { Special } from "../types/special-types";

export type SpecialFormValues = PrebattleRollValues & {
  name: string;
  type: string;
  typeCommitted: boolean;
  kind: SpecialKind;
  category: SpecialCategory;
  cost: string;
  description: string;
};

const valuesOf = (special: Special | null): SpecialFormValues => ({
  name: special?.name ?? "",
  type: special?.type ?? "",
  typeCommitted: true,
  kind: special?.kind ?? "trait",
  category: special?.category ?? "aura",
  cost: special?.cost != null ? String(special.cost) : "",
  description: special?.description ?? "",
  ...prebattleValuesOf(special ?? undefined),
});

/**
 * Boons & Banes' Add new and Edit (William, 22 Nov 2026: "We also need a way to add a special"):
 * a special's name, type, kind (boon, bane or trait: its icon's colour), category (its icon), price
 * where a list sells it, pre-battle roll and rules, saved into the cached list. A book special's
 * first edit makes the campaign's version of it, which Revert takes back; Delete is the catalogue's.
 */
export function useSpecialForm({
  campaignId,
  special,
  typeOptions,
  resetKey,
  onSaved,
  onDeleted,
}: {
  campaignId: number;
  /** The special being edited; null when adding one. */
  special: Special | null;
  typeOptions: readonly string[];
  resetKey: unknown;
  onSaved: (special: Special) => void;
  onDeleted?: (specialId: number) => void;
}) {
  const catalogueCache = useCatalogueCache();
  const [values, setValues] = useState(() => valuesOf(special));
  const { dirty, markClean } = useDirtySince(values);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(["name"], resetKey);
  const nameTaken = useNameTakenMatches({ kind: "specials", campaignId, fieldErrors });
  const deletion = useCatalogueDelete({
    kind: "specials",
    campaignId,
    entry: special,
    noun: "boon or bane",
    onDeleted,
  });
  const revert = useCatalogueRevert({
    kind: "specials",
    campaignId,
    entry: special,
    onReverted: onSaved,
  });
  const typeField = useCatalogueTypeField({
    value: values.type,
    onChange: (type, typeCommitted) => setValues((prev) => ({ ...prev, type, typeCommitted })),
    typeOptions,
    extraOption: special?.type,
  });
  const set = (change: Partial<SpecialFormValues>) => setValues((prev) => ({ ...prev, ...change }));

  const save = async (after?: () => void) => {
    if (!values.name.trim() || !values.type.trim() || !values.description.trim()) {
      setFormError("Name, type and description are required.");
      return;
    }
    if (!values.typeCommitted) {
      setFormError("Add or select a type before saving.");
      return;
    }
    const cost = values.cost.trim() ? Number(values.cost) : null;
    if (cost !== null && (Number.isNaN(cost) || cost < 0)) {
      setFormError("Price must be a number of gold crowns.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      const payload = {
        name: values.name.trim(),
        type: values.type.trim(),
        kind: values.kind,
        category: values.category,
        cost,
        description: values.description.trim(),
        ...prebattlePayload(values),
      };
      const saved = special
        ? await updateSpecial(special.id, { ...payload, ...bookCampaign(special, campaignId) })
        : await createSpecial({ ...payload, campaign_id: campaignId });
      catalogueCache.write("specials", campaignId, saved, special?.id);
      // the units' copies now point at the version, or show the edited rule: sheets read them again
      if (special) void catalogueCache.heldCopiesChanged("specials", campaignId);
      onSaved(saved);
      after?.();
    } catch (errorResponse) {
      setFormError(
        fieldErrors.take(
          errorResponse,
          special ? "Unable to save the boon or bane" : "Unable to add the boon or bane"
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const { reset: resetTypeField } = typeField;
  const { clear: clearFieldErrors } = fieldErrors;
  const load = useCallback(
    (entry: Special | null) => {
      setValues(valuesOf(entry));
      markClean();
      resetTypeField();
      setFormError("");
      clearFieldErrors();
    },
    [clearFieldErrors, markClean, resetTypeField]
  );

  return {
    dirty,
    values,
    set,
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

export type SpecialFormState = ReturnType<typeof useSpecialForm>;
