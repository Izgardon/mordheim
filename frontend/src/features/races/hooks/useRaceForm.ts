import { useCallback, useState } from "react";

import {
  STAT_FIELDS,
  statInputs,
  type StatInputs,
  type StatKey,
} from "@/features/catalogue/utils/statblock";
import { useFieldErrors } from "@/lib/field-errors";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";

import { createRace } from "../api/races-api";

import type { Race } from "../types/race-types";

type RaceFormValues = {
  name: string;
  /** The race's maximum characteristics. */
  stats: StatInputs;
};

const blank = (): RaceFormValues => ({ name: "", stats: statInputs("0") });

/** A maximum from 0 to 10, or null. */
const parseStat = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10 ? parsed : null;
};

type UseRaceFormOptions = {
  campaignId: number;
  /** Server field errors clear whenever this changes (the dialog opening or closing). */
  resetKey: unknown;
  /** After a create: the caller puts the race in its list. */
  onSaved: (race: Race) => void;
};

/** A race's Add form (the race picker's dialog): its name and its maximum characteristics. */
export function useRaceForm({ campaignId, resetKey, onSaved }: UseRaceFormOptions) {
  const [values, setValues] = useState(blank);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(["name"], resetKey);
  const nameTaken = useNameTakenMatches({
    kind: "races",
    campaignId,
    fieldErrors,
  });

  const save = async (after?: () => void) => {
    if (Number.isNaN(campaignId)) {
      setFormError("Unable to create race.");
      return;
    }
    if (!values.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    const stats = {} as Record<StatKey, number>;
    for (const { key } of STAT_FIELDS) {
      const parsed = parseStat(values.stats[key]);
      if (parsed === null) {
        setFormError("All stats must be between 0 and 10.");
        return;
      }
      stats[key] = parsed;
    }
    setIsSaving(true);
    setFormError("");
    try {
      const race = await createRace({
        name: values.name.trim(),
        ...stats,
        campaign_id: campaignId,
      });
      onSaved(race);
      after?.();
    } catch (errorResponse) {
      setFormError(fieldErrors.take(errorResponse, "Unable to create race"));
    } finally {
      setIsSaving(false);
    }
  };

  const { clear: clearFieldErrors } = fieldErrors;
  /** Back to a blank form with no message. */
  const reset = useCallback(() => {
    setValues(blank());
    setFormError("");
    clearFieldErrors();
  }, [clearFieldErrors]);

  return {
    values,
    setName: (name: string) => setValues((prev) => ({ ...prev, name })),
    setStat: (key: StatKey, value: string) =>
      setValues((prev) => ({ ...prev, stats: { ...prev.stats, [key]: value } })),
    fieldErrors: fieldErrors.errors,
    nameTaken,
    isSaving,
    formError,
    save,
    reset,
  };
}

export type RaceFormState = ReturnType<typeof useRaceForm>;
