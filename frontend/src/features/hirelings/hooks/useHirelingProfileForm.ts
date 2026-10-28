import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useBestiaryLinks } from "@/features/bestiary/hooks/useBestiaryLinks";
import { bookCampaign } from "@/features/catalogue/api/catalogue-entry-api";
import { useCatalogueDelete } from "@/features/catalogue/hooks/useCatalogueDelete";
import { useCatalogueRevert } from "@/features/catalogue/hooks/useCatalogueRevert";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors, type NameMatch } from "@/lib/field-errors";
import { queryKeys } from "@/lib/query-keys";

import { createHirelingProfile, updateHirelingProfile } from "../api/hireling-catalogue-api";
import {
  hirelingPayload,
  hirelingValuesOf,
  type HirelingProfileValues,
} from "../utils/hireling-form";
import { useHirelingRestrictions } from "./useHirelingRestrictions";

import type { HirelingCatalogueConfig } from "../hireling-catalogue-kinds";
import type { HirelingProfile, HirelingProfileDetail } from "../types/hireling-catalogue-types";

/** The fields a refusal can name that the form shows by their input. */
const SHOWN_FIELDS = [
  "name",
  "armour_save",
  "race_label",
  "hire_cost",
  "hire_cost_expression",
  "upkeep_cost",
  "upkeep_cost_expression",
  "rating",
  "item_entries",
  "payment_note",
];

/** A hireling's kit carries at most this many of one item (hiring writes a row per copy). */
export const MAX_KIT_QUANTITY = 20;

type UseHirelingProfileFormOptions = {
  config: HirelingCatalogueConfig;
  campaignId: number;
  /** The entry being edited, with its links; null when adding one. */
  entry: HirelingProfileDetail | null;
  /** The pickers read the campaign's lists only while the form is open. */
  open: boolean;
  /** Server field errors clear whenever this changes. */
  resetKey: unknown;
  /** After a save, its answer already in the cached lists (a book entry's first edit: the version). */
  onSaved: (saved: HirelingProfileDetail) => void;
  onDeleted?: (entryId: number) => void;
  /** After a Revert, the book entry already in the version's place. */
  onReverted?: (book: HirelingProfile) => void;
  /** Opens the form on an entry a taken name collided with ("Edit this instead"). */
  onEditMatch?: (match: NameMatch) => void;
};

/**
 * A hired sword's or dramatis persona's Add or Edit form (`use<Kind>Form`): the profile, race, hire
 * terms, skill lists, kit, restrictions and a dramatis persona's terms; the save (a book entry's
 * first edit makes the campaign's version, written in its place), Delete with its usage check, and
 * Revert. A taken name keeps the form open with its matches.
 */
export function useHirelingProfileForm({
  config,
  campaignId,
  entry,
  open,
  resetKey,
  onSaved,
  onDeleted,
  onReverted,
  onEditMatch,
}: UseHirelingProfileFormOptions) {
  const { kind } = config;
  const queryClient = useQueryClient();
  const catalogueCache = useCatalogueCache();
  const [values, setValues] = useState(() => hirelingValuesOf(entry));
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(SHOWN_FIELDS, resetKey);
  const links = useBestiaryLinks({
    campaignId,
    open,
    specialType: config.specialType,
    maxQuantity: MAX_KIT_QUANTITY,
  });
  const restrictions = useHirelingRestrictions({ campaignId, enabled: open });
  const nameTaken = useNameTakenMatches({ kind, campaignId, fieldErrors, onEditMatch });
  const deletion = useCatalogueDelete({
    kind,
    campaignId,
    entry,
    noun: config.labels.noun,
    onDeleted,
  });
  /** A write's answer (the entry as its detail reads), cached: the panel shows it with no read. */
  const cacheDetail = (saved: HirelingProfileDetail) =>
    queryClient.setQueryData(queryKeys.campaign.catalogueEntry(campaignId, kind, saved.id), saved);
  const revert = useCatalogueRevert({
    kind,
    campaignId,
    entry,
    onReverted: (book) => {
      cacheDetail(book as HirelingProfileDetail);
      onReverted?.(book);
    },
  });

  const save = async (after?: () => void) => {
    if (!values.name.trim()) {
      setFormError("A name is required.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    const payload = hirelingPayload(config, values, {
      ...links.payload(),
      restriction_ids: restrictions.payload(),
    });
    try {
      const saved = entry
        ? await updateHirelingProfile(kind, entry.id, {
            ...payload,
            ...bookCampaign(entry, campaignId),
          })
        : await createHirelingProfile(kind, { ...payload, campaign_id: campaignId });
      catalogueCache.write(kind, campaignId, saved, entry?.id);
      cacheDetail(saved);
      onSaved(saved);
      after?.();
    } catch (caught) {
      setFormError(fieldErrors.take(caught, `Unable to save ${config.labels.noun}`));
    } finally {
      setIsSaving(false);
    }
  };

  const { load: loadLinks } = links;
  const { load: loadRestrictions } = restrictions;
  const { clear: clearFieldErrors } = fieldErrors;
  /** Back to `next`'s values and links (a blank form for null), with no message. */
  const load = useCallback(
    (next: HirelingProfileDetail | null) => {
      setValues(hirelingValuesOf(next));
      loadLinks(next);
      loadRestrictions(next?.restrictions ?? null);
      setFormError("");
      clearFieldErrors();
    },
    [clearFieldErrors, loadLinks, loadRestrictions]
  );

  return {
    config,
    campaignId,
    values,
    change: (patch: Partial<HirelingProfileValues>) => setValues((prev) => ({ ...prev, ...patch })),
    /** Ticks or unticks one of the skill lists the entry may learn from. */
    toggleSkillType: (type: string, on: boolean) =>
      setValues((prev) => ({
        ...prev,
        available_skill_types: on
          ? [...prev.available_skill_types, type]
          : prev.available_skill_types.filter((listed) => listed !== type),
      })),
    links,
    restrictions,
    fieldErrors: fieldErrors.errors,
    nameTaken,
    isSaving: isSaving || deletion.isDeleting,
    formError,
    deleteConfirm: deletion.deleteConfirm,
    remove: deletion.remove,
    revert,
    save,
    load,
  };
}

export type HirelingProfileFormState = ReturnType<typeof useHirelingProfileForm>;
