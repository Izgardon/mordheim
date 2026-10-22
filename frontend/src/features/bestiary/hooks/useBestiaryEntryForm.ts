import { useState } from "react";
import type { FormEvent } from "react";

import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors } from "@/lib/field-errors";

import { createBestiaryEntry } from "../api/bestiary-api";
import {
  bestiaryCorePayload,
  blankBestiaryCore,
  type BestiaryCoreValues,
} from "../utils/bestiary-form";
import { useBestiaryLinks } from "./useBestiaryLinks";

import type { BestiaryEntry } from "../types/bestiary-types";

export type BestiaryEntryValues = BestiaryCoreValues & { type: string };

const blank = (): BestiaryEntryValues => ({ ...blankBestiaryCore(), type: "Attack" });

type UseBestiaryEntryFormOptions = {
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (entry: BestiaryEntry) => void;
};

/**
 * The Bestiary's Add entry form: the entry, its links, and the create (the bestiary list is
 * marked stale; a taken name shows under Name). Closing keeps what was entered; a create clears it.
 */
export function useBestiaryEntryForm({
  campaignId,
  open,
  onOpenChange,
  onCreated,
}: UseBestiaryEntryFormOptions) {
  const [values, setValues] = useState(blank);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const fieldErrors = useFieldErrors(["name"], open);
  const links = useBestiaryLinks({ campaignId, open, specialType: "Animal" });
  const catalogueCache = useCatalogueCache();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim() || !values.type) return;

    setIsSaving(true);
    setError("");
    try {
      const entry = await createBestiaryEntry({
        campaign_id: campaignId,
        type: values.type,
        ...bestiaryCorePayload(values),
        ...links.payload(),
      });
      void catalogueCache.invalidate("bestiary", campaignId);
      onCreated?.(entry);
      setValues(blank());
      links.reset();
      onOpenChange(false);
    } catch (err) {
      setError(fieldErrors.take(err, "Failed to create entry"));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    values,
    change: (patch: Partial<BestiaryEntryValues>) => setValues((prev) => ({ ...prev, ...patch })),
    links,
    fieldErrors: fieldErrors.errors,
    isSaving,
    error,
    submit,
  };
}

export type BestiaryEntryFormState = ReturnType<typeof useBestiaryEntryForm>;
