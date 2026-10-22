import { useCallback, useState } from "react";

import { useCatalogueTypeField } from "@/features/catalogue/hooks/useCatalogueTypeField";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors } from "@/lib/field-errors";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";

import { createSpecial } from "../api/special-api";

import type { Special } from "../types/special-types";

type SpecialFormValues = {
  name: string;
  type: string;
  description: string;
  typeCommitted: boolean;
};

const BLANK: SpecialFormValues = { name: "", type: "", description: "", typeCommitted: false };

type UseSpecialFormOptions = {
  campaignId: number;
  typeOptions: readonly string[];
  /** Server field errors clear whenever this changes (the dialog opening or closing). */
  resetKey: unknown;
  /** After a create, its answer already in the cached specials list. */
  onSaved: (special: Special) => void;
};

/**
 * A special's Add form (the warband pages' dialog): name, category ("type") and description,
 * saved trimmed, the answer put into the cached list. Categories added in the form outlast a
 * reset, as they always have here.
 */
export function useSpecialForm({
  campaignId,
  typeOptions,
  resetKey,
  onSaved,
}: UseSpecialFormOptions) {
  const catalogueCache = useCatalogueCache();
  const [values, setValues] = useState(BLANK);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(["name"], resetKey);
  const nameTaken = useNameTakenMatches({
    kind: "specials",
    campaignId,
    fieldErrors,
  });
  const typeField = useCatalogueTypeField({
    value: values.type,
    onChange: (type, typeCommitted) => setValues((prev) => ({ ...prev, type, typeCommitted })),
    typeOptions,
  });

  const save = async (after?: () => void) => {
    if (Number.isNaN(campaignId)) {
      setFormError("Unable to create entry.");
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
    setIsSaving(true);
    setFormError("");
    try {
      const saved = await createSpecial({
        name: values.name.trim(),
        type: values.type.trim(),
        description: values.description.trim(),
        campaign_id: campaignId,
      });
      catalogueCache.upsert("specials", campaignId, saved);
      onSaved(saved);
      after?.();
    } catch (errorResponse) {
      setFormError(fieldErrors.take(errorResponse, "Unable to create entry"));
    } finally {
      setIsSaving(false);
    }
  };

  const { reset: resetTypeField } = typeField;
  const { clear: clearFieldErrors } = fieldErrors;
  /** Back to a blank form with no message. */
  const reset = useCallback(() => {
    setValues(BLANK);
    resetTypeField(true);
    setFormError("");
    clearFieldErrors();
  }, [clearFieldErrors, resetTypeField]);

  return {
    values,
    setValue: (field: "name" | "description", value: string) =>
      setValues((prev) => ({ ...prev, [field]: value })),
    typeField,
    fieldErrors: fieldErrors.errors,
    nameTaken,
    isSaving,
    formError,
    save,
    reset,
  };
}

export type SpecialFormState = ReturnType<typeof useSpecialForm>;
