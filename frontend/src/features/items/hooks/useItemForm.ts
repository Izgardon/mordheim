import { useCallback, useState } from "react";

import type { StatLabel } from "@/features/catalogue/utils/statblock";
import { blankItemStatblock } from "@/features/catalogue/utils/statblock";
import { bookCampaign } from "@/features/catalogue/api/catalogue-entry-api";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";
import { useCatalogueDelete } from "@/features/catalogue/hooks/useCatalogueDelete";
import { useCatalogueRevert } from "@/features/catalogue/hooks/useCatalogueRevert";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors, type NameMatch } from "@/lib/field-errors";

import { createItem, updateItem } from "../api/items-api";
import { ITEM_FIELDS } from "../utils/item-form-fields";
import {
  ITEM_SUBTYPE_OPTIONS,
  blankAvailability,
  itemFormProblems,
  itemPayload,
  itemPropertiesOf,
  itemTypeOptions,
  itemValuesOf,
  type AvailabilityRow,
  type AvailabilityTextField,
  type ItemFormValues,
} from "../utils/item-form-values";
import { useItemPropertyPicker } from "./useItemPropertyPicker";

import type { Item } from "../types/item-types";

type ItemTextField = "name" | "subtype" | "description" | "strength" | "range" | "save";

type UseItemFormOptions = {
  campaignId: number;
  /** The item being edited; null when adding one. */
  item: Item | null;
  /** The form shows (a closed dialog reads no property list). */
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
 * An item's Add or Edit form, inline on the Wargear page or in the warband pages' dialog: the
 * values, the availabilities, the properties, the checks before sending (BUG-53's price, under
 * Price and Rarity), the
 * save (the answer goes into the cached list; refusals land on their fields) and the delete
 * (refusals stay in its confirm, BUG-148).
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
  const [values, setValues] = useState<ItemFormValues>(() => itemValuesOf(item));
  const [showFluff, setShowFluff] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(ITEM_FIELDS, resetKey);
  const nameTaken = useNameTakenMatches({
    kind: "items",
    campaignId,
    fieldErrors,
    onEditMatch,
  });
  const deletion = useCatalogueDelete({
    kind: "items",
    campaignId,
    entry: item,
    noun: "item",
    onDeleted,
  });
  const revert = useCatalogueRevert({ kind: "items", campaignId, entry: item, onReverted });
  const properties = useItemPropertyPicker({
    campaignId,
    type: values.type,
    enabled,
    initial: itemPropertiesOf(item),
  });

  const setRows = (update: (rows: AvailabilityRow[]) => AvailabilityRow[]) =>
    setValues((prev) => ({ ...prev, availabilities: update(prev.availabilities) }));

  const save = async (after?: () => void) => {
    // The server's limits, checked before sending, under the fields they concern.
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
    const payload = itemPayload(
      values,
      properties.selected.map((property) => property.id)
    );
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

  const { load: loadProperties } = properties;
  const { clear: clearFieldErrors } = fieldErrors;
  /** Back to `entry`'s values and chips (a blank form for null), its fluff shown if it has one. */
  const load = useCallback(
    (entry: Item | null) => {
      setValues(itemValuesOf(entry));
      loadProperties(itemPropertiesOf(entry));
      setShowFluff(Boolean(entry?.description));
      setFormError("");
      clearFieldErrors();
    },
    [clearFieldErrors, loadProperties]
  );

  return {
    values,
    typeOptions: itemTypeOptions(item),
    subtypeOptions: ITEM_SUBTYPE_OPTIONS[values.type] ?? [],
    setValue: (field: ItemTextField, value: string) =>
      setValues((prev) => ({ ...prev, [field]: value })),
    /** A new type starts at its first subtype; only animals keep a statblock, only misc single use. */
    setType: (type: string) =>
      setValues((prev) => ({
        ...prev,
        type,
        subtype: ITEM_SUBTYPE_OPTIONS[type]?.[0] ?? "",
        statblock: type === "Animal" ? prev.statblock : blankItemStatblock(),
        singleUse: type === "Miscellaneous" ? prev.singleUse : false,
      })),
    setSingleUse: (singleUse: boolean) => setValues((prev) => ({ ...prev, singleUse })),
    setStat: (label: StatLabel, value: string) =>
      setValues((prev) => ({ ...prev, statblock: { ...prev.statblock, [label]: value } })),
    addAvailability: () => setRows((rows) => [...rows, blankAvailability()]),
    removeAvailability: (index: number) => setRows((rows) => rows.filter((_, i) => i !== index)),
    setAvailability: (index: number, field: AvailabilityTextField, value: string) =>
      setRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))),
    showFluff,
    setShowFluff,
    properties,
    fieldErrors: fieldErrors.errors,
    nameTaken,
    rowError: (index: number, field: "cost" | "rarity") =>
      fieldErrors.errors[`availabilities.${index}.${field}`],
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
