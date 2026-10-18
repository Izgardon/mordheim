import { useCallback, useState } from "react";

import {
  DEFAULT_CUSTOM_UNIT_DRAFT,
  type CustomUnitDraft,
  type PrebattleUnit,
  type StatKey,
} from "@/features/battles/components/prebattle/prebattle-types";
import {
  customUnitFromDraft,
  draftWithStat,
  makeCustomUnitKey,
} from "@/features/battles/utils/custom-unit-draft";

/**
 * The "Add Temporary Unit" form (prebattle, active): open or closed, the draft and its error.
 * `buildUnit` returns the unit the draft describes, or null with the error shown.
 */
export function useCustomUnitDraft() {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<CustomUnitDraft>({ ...DEFAULT_CUSTOM_UNIT_DRAFT });
  const [error, setError] = useState("");

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
    setError("");
  }, []);

  const changeDraft = useCallback((next: CustomUnitDraft) => {
    setDraft(next);
    setError("");
  }, []);

  const changeStat = useCallback((key: StatKey, value: string) => {
    setDraft((prev) => draftWithStat(prev, key, value));
  }, []);

  const buildUnit = useCallback((): PrebattleUnit | null => {
    if (!draft.name.trim() || !draft.unitType.trim()) {
      setError("Temporary units need a name and unit type.");
      return null;
    }
    return customUnitFromDraft(draft, makeCustomUnitKey());
  }, [draft]);

  /** Closes the form and clears its error, keeping the draft. */
  const close = useCallback(() => {
    setIsOpen(false);
    setError("");
  }, []);

  /** Closes the form with an empty draft. */
  const reset = useCallback(() => {
    setDraft({ ...DEFAULT_CUSTOM_UNIT_DRAFT });
    setError("");
    setIsOpen(false);
  }, []);

  return { isOpen, draft, error, toggleOpen, changeDraft, changeStat, buildUnit, close, reset };
}

export type CustomUnitDraftState = ReturnType<typeof useCustomUnitDraft>;
