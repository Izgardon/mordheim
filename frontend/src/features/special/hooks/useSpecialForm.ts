import { useCallback, useState } from "react";

import type { SpecialCategory, SpecialKind } from "@/components/ui/game-icons";
import { useDirtySince } from "@/components/ui/discard-changes";
import {
  prebattlePayload,
  prebattleValuesOf,
  type PrebattleRollValues,
} from "@/features/catalogue/components/PrebattleRollFields";
import { useCatalogueTypeField } from "@/features/catalogue/hooks/useCatalogueTypeField";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors } from "@/lib/field-errors";

import { createSpecial } from "../api/special-api";
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

const BLANK: SpecialFormValues = {
  name: "",
  type: "",
  typeCommitted: true,
  kind: "trait",
  category: "aura",
  cost: "",
  description: "",
  ...prebattleValuesOf(),
};

/**
 * Boons & Banes' Add new (William, 22 Nov 2026: "We also need a way to add a special"): a
 * campaign's own special, its name, type, kind (boon, bane or trait: its icon's colour), category
 * (its icon), price where a list sells it, pre-battle roll and rules, saved into the cached list.
 */
export function useSpecialForm({
  campaignId,
  typeOptions,
  resetKey,
  onSaved,
}: {
  campaignId: number;
  typeOptions: readonly string[];
  resetKey: unknown;
  onSaved: (special: Special) => void;
}) {
  const catalogueCache = useCatalogueCache();
  const [values, setValues] = useState(BLANK);
  const { dirty, markClean } = useDirtySince(values);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(["name"], resetKey);
  const nameTaken = useNameTakenMatches({ kind: "specials", campaignId, fieldErrors });
  const typeField = useCatalogueTypeField({
    value: values.type,
    onChange: (type, typeCommitted) => setValues((prev) => ({ ...prev, type, typeCommitted })),
    typeOptions,
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
      const saved = await createSpecial({
        campaign_id: campaignId,
        name: values.name.trim(),
        type: values.type.trim(),
        kind: values.kind,
        category: values.category,
        cost,
        description: values.description.trim(),
        ...prebattlePayload(values),
      });
      catalogueCache.write("specials", campaignId, saved);
      onSaved(saved);
      after?.();
    } catch (errorResponse) {
      setFormError(fieldErrors.take(errorResponse, "Unable to add the boon or bane"));
    } finally {
      setIsSaving(false);
    }
  };

  const { reset: resetTypeField } = typeField;
  const { clear: clearFieldErrors } = fieldErrors;
  const load = useCallback(() => {
    setValues(BLANK);
    markClean();
    resetTypeField();
    setFormError("");
    clearFieldErrors();
  }, [clearFieldErrors, markClean, resetTypeField]);

  return {
    dirty,
    values,
    set,
    typeField,
    fieldErrors: fieldErrors.errors,
    nameTaken,
    isSaving,
    formError,
    save,
    load,
  };
}

export type SpecialFormState = ReturnType<typeof useSpecialForm>;
