import { useState } from "react";
import type { FormEvent } from "react";

import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors } from "@/lib/field-errors";

import { createHiredSwordProfile } from "../api/bestiary-api";
import {
  bestiaryCorePayload,
  blankBestiaryCore,
  type BestiaryCoreValues,
} from "../utils/bestiary-form";
import { useBestiaryLinks } from "./useBestiaryLinks";

import type { HiredSwordProfile } from "../types/bestiary-types";

export type HiredSwordValues = BestiaryCoreValues & {
  hire_cost: string;
  hire_cost_expression: string;
  upkeep_cost: string;
  upkeep_cost_expression: string;
  available_skill_types: string[];
};

const blank = (): HiredSwordValues => ({
  ...blankBestiaryCore(),
  hire_cost: "",
  hire_cost_expression: "",
  upkeep_cost: "",
  upkeep_cost_expression: "",
  available_skill_types: [],
});

type UseHiredSwordFormOptions = {
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (profile: HiredSwordProfile) => void;
};

/**
 * Hired Swords' Add form: the entry, its costs and skill lists, its links, and the create (both
 * the hired-sword and bestiary lists are marked stale; a taken name or a refused cost shows
 * under its field). Closing keeps what was entered; a create clears it.
 */
export function useHiredSwordForm({
  campaignId,
  open,
  onOpenChange,
  onCreated,
}: UseHiredSwordFormOptions) {
  const [values, setValues] = useState(blank);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const fieldErrors = useFieldErrors(["name", "hire_cost", "upkeep_cost"], open);
  const links = useBestiaryLinks({ campaignId, open, specialType: "Hired Sword" });
  const catalogueCache = useCatalogueCache();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) return;

    setIsSaving(true);
    setError("");
    try {
      const profile = await createHiredSwordProfile({
        campaign_id: campaignId,
        type: "Hired Sword",
        ...bestiaryCorePayload(values),
        ...links.payload(),
        hire_cost: values.hire_cost ? Number(values.hire_cost) : null,
        hire_cost_expression: values.hire_cost_expression.trim(),
        upkeep_cost: values.upkeep_cost ? Number(values.upkeep_cost) : null,
        upkeep_cost_expression: values.upkeep_cost_expression.trim(),
        available_skill_types: values.available_skill_types,
      });
      // A profile brings its own bestiary entry, so both lists change.
      void catalogueCache.invalidate("hired-swords", campaignId);
      void catalogueCache.invalidate("bestiary", campaignId);
      onCreated?.(profile);
      setValues(blank());
      links.reset();
      onOpenChange(false);
    } catch (err) {
      setError(fieldErrors.take(err, "Failed to create hired sword"));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    values,
    change: (patch: Partial<HiredSwordValues>) => setValues((prev) => ({ ...prev, ...patch })),
    /** Ticks or unticks one of the skill lists the hired sword may learn from. */
    toggleSkillType: (type: string, on: boolean) =>
      setValues((prev) => ({
        ...prev,
        available_skill_types: on
          ? [...prev.available_skill_types, type]
          : prev.available_skill_types.filter((t) => t !== type),
      })),
    links,
    fieldErrors: fieldErrors.errors,
    isSaving,
    error,
    submit,
  };
}

export type HiredSwordFormState = ReturnType<typeof useHiredSwordForm>;
