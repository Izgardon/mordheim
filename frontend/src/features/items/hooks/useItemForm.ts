import { useCallback, useState } from "react";

import { bookCampaign } from "@/features/catalogue/api/catalogue-entry-api";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";
import { useCatalogueDelete } from "@/features/catalogue/hooks/useCatalogueDelete";
import { useCatalogueRevert } from "@/features/catalogue/hooks/useCatalogueRevert";
import { useCatalogue, useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors, type NameMatch } from "@/lib/field-errors";

import { createItem, updateItem } from "../api/items-api";
import { ITEM_FIELDS } from "../utils/item-form-fields";
import {
  ITEM_SUBTYPE_OPTIONS,
  itemFormProblems,
  itemPayload,
  itemTypeOptions,
  itemValuesOf,
  type ItemFormValues,
  type ItemTextField,
  type RuleDraft,
} from "../utils/item-form-values";
import type { PriceRowDraft } from "../utils/price-rows";

import type { Item } from "../types/item-types";

type UseItemFormOptions = {
  campaignId: number;
  /** The item being edited; null when adding one. */
  item: Item | null;
  /** The form shows (a closed dialog reads no shared-rule list). */
  enabled: boolean;
  /** Server field errors clear whenever this changes (the edited item, or the dialog opening). */
  resetKey: unknown;
  /** After a save, its answer already in the cached items list. */
  onSaved: (item: Item) => void;
  /** After a delete, the item already gone from the cached list. */
  onDeleted?: (itemId: number) => void;
  /** Opens the edit form on an entry a taken name collided with ("Edit this instead"). */
  onEditMatch?: (match: NameMatch) => void;
  /** After a Revert, the book's item already in the version's place in the cached list. */
  onReverted?: (item: Item) => void;
};

/**
 * A house item's Add or Edit form (the items rebuild): its text and figures, its rules (shared
 * ones from the campaign's list, or its own with an optional D6 table), its price rows with who
 * may buy each, the checks before sending (under the fields the server would name), the save (the
 * answer goes into the cached list) and the delete (refusals stay in its confirm, BUG-148).
 */
export function useItemForm({
  campaignId,
  item,
  enabled,
  resetKey,
  onSaved,
  onDeleted,
  onReverted,
  onEditMatch,
}: UseItemFormOptions) {
  const catalogueCache = useCatalogueCache();
  const shared = useCatalogue("item-rules", campaignId, { enabled }).data;
  const [values, setValues] = useState<ItemFormValues>(() => itemValuesOf(item));
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(ITEM_FIELDS, resetKey);
  const nameTaken = useNameTakenMatches({ kind: "items", campaignId, fieldErrors, onEditMatch });
  const deletion = useCatalogueDelete({
    kind: "items",
    campaignId,
    entry: item,
    noun: "item",
    onDeleted,
  });
  const revert = useCatalogueRevert({ kind: "items", campaignId, entry: item, onReverted });

  const save = async (after?: () => void) => {
    const problems = itemFormProblems(values);
    if (problems.line || Object.keys(problems.fields).length > 0) {
      setFormError(problems.line ?? "");
      fieldErrors.show(problems.fields);
      return;
    }
    if (!item && Number.isNaN(campaignId)) {
      setFormError("Unable to create item.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    const payload = itemPayload(values);
    try {
      // A book item's first edit makes the campaign's version of it (CAT-TWEAK-01).
      const saved = item
        ? await updateItem(item.id, { ...payload, ...bookCampaign(item, campaignId) })
        : await createItem({ ...payload, campaign_id: campaignId });
      catalogueCache.write("items", campaignId, saved, item?.id);
      if (item) {
        // The copies now point at the version, or show the edited entry: sheets read them again.
        void catalogueCache.heldCopiesChanged("items", campaignId);
      }
      onSaved(saved);
      after?.();
    } catch (errorResponse) {
      setFormError(fieldErrors.take(errorResponse, "Unable to save item"));
    } finally {
      setIsSaving(false);
    }
  };

  const { clear: clearFieldErrors } = fieldErrors;
  /** Back to `entry`'s values (a blank form for null). */
  const load = useCallback(
    (entry: Item | null) => {
      setValues(itemValuesOf(entry, shared));
      setFormError("");
      clearFieldErrors();
    },
    [clearFieldErrors, shared]
  );

  return {
    campaignId,
    values,
    shared,
    typeOptions: itemTypeOptions(item),
    subtypeOptions: ITEM_SUBTYPE_OPTIONS[values.type] ?? [],
    setValue: (field: ItemTextField, value: string) =>
      setValues((prev) => ({ ...prev, [field]: value })),
    /** A new type starts at its first subtype; only misc is single use. */
    setType: (type: string) =>
      setValues((prev) => ({
        ...prev,
        type,
        subtype: ITEM_SUBTYPE_OPTIONS[type]?.[0] ?? "",
        singleUse: type === "Miscellaneous" ? prev.singleUse : false,
      })),
    setSingleUse: (singleUse: boolean) => setValues((prev) => ({ ...prev, singleUse })),
    setRules: (rules: RuleDraft[]) => setValues((prev) => ({ ...prev, rules })),
    setPrices: (prices: PriceRowDraft[]) => setValues((prev) => ({ ...prev, prices })),
    fieldErrors: fieldErrors.errors,
    errorOf: (path: string) => fieldErrors.errors[path],
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

export type ItemFormState = ReturnType<typeof useItemForm>;
