import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ParticipantRoster,
  PrebattleUnit,
  StatKey,
  UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import { flattenRosterUnits } from "@/features/battles/components/prebattle/prebattle-utils";
import { useCustomUnitDraft } from "@/features/battles/hooks/useCustomUnitDraft";
import type { BattleParticipant } from "@/features/battles/types/battle-types";
import {
  initialPrebattleConfig,
  withOverrideStat,
  withUnitNotes,
  withoutKey,
} from "@/features/battles/utils/prebattle-config";

/**
 * Your prebattle form: the units you bring, temporary stat changes and notes, temporary units, and
 * the unit being edited. Starts from what the server saved once your roster is loaded; Ready Up
 * saves it (`usePrebattleReady`).
 */
export function usePrebattleConfig({
  battleId,
  currentParticipant,
  ownRoster,
  currentUserReady,
}: {
  battleId: number;
  currentParticipant: BattleParticipant | null;
  ownRoster: ParticipantRoster | undefined;
  currentUserReady: boolean;
}) {
  const [selectedUnitKeys, setSelectedUnitKeys] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, UnitOverride>>({});
  const [unitNotes, setUnitNotes] = useState<Record<string, string>>({});
  const [customUnits, setCustomUnits] = useState<PrebattleUnit[]>([]);
  const [editingUnitKey, setEditingUnitKey] = useState<string | null>(null);
  const customUnitDraft = useCustomUnitDraft();
  const { reset: resetCustomUnitDraft, close: closeCustomUnitDraft, buildUnit } = customUnitDraft;
  const initializedRef = useRef(false);
  const savedHashRef = useRef("");
  const participantId = currentParticipant?.id;

  useEffect(() => {
    initializedRef.current = false;
    setUnitNotes({});
    setCustomUnits([]);
    resetCustomUnitDraft();
  }, [battleId, participantId, resetCustomUnitDraft]);

  useEffect(() => {
    if (!currentParticipant || !ownRoster || initializedRef.current) {
      return;
    }
    const initial = initialPrebattleConfig(currentParticipant, ownRoster);
    setCustomUnits(initial.customUnits);
    setSelectedUnitKeys(initial.selectedKeys);
    setOverrides(initial.overrides);
    setUnitNotes(initial.notes);
    savedHashRef.current = initial.savedHash;
    initializedRef.current = true;
  }, [currentParticipant, ownRoster]);

  // Once you are ready the form is locked.
  useEffect(() => {
    if (!currentUserReady) {
      return;
    }
    setEditingUnitKey(null);
    closeCustomUnitDraft();
  }, [closeCustomUnitDraft, currentUserReady]);

  const ownRosterUnits = useMemo(() => flattenRosterUnits(ownRoster), [ownRoster]);
  const ownUnits = useMemo(
    () => [...ownRosterUnits, ...customUnits],
    [customUnits, ownRosterUnits]
  );
  const ownUnitKeys = useMemo(() => ownUnits.map((unit) => unit.key), [ownUnits]);

  const toggleUnitSelection = useCallback((unitKey: string) => {
    setSelectedUnitKeys((prev) =>
      prev.includes(unitKey) ? prev.filter((entry) => entry !== unitKey) : [...prev, unitKey]
    );
  }, []);

  const updateOverrideStat = useCallback((unit: PrebattleUnit, key: StatKey, value: string) => {
    setOverrides((prev) => withOverrideStat(prev, unit, key, value));
  }, []);

  const clearUnitOverride = useCallback((unitKey: string) => {
    setOverrides((prev) => withoutKey(prev, unitKey));
  }, []);

  const updateUnitNotes = useCallback((unitKey: string, notes: string) => {
    setUnitNotes((prev) => withUnitNotes(prev, unitKey, notes));
  }, []);

  const toggleEditingUnit = useCallback((unitKey: string) => {
    setEditingUnitKey((prev) => (prev === unitKey ? null : unitKey));
  }, []);

  const removeCustomUnit = useCallback((unitKey: string) => {
    setCustomUnits((prev) => prev.filter((unit) => unit.key !== unitKey));
    setSelectedUnitKeys((prev) => prev.filter((key) => key !== unitKey));
    setOverrides((prev) => withoutKey(prev, unitKey));
    setUnitNotes((prev) => withoutKey(prev, unitKey));
    setEditingUnitKey((prev) => (prev === unitKey ? null : prev));
  }, []);

  /** Adds the drafted temporary unit, selected; false (with the form's error) when incomplete. */
  const addCustomUnit = useCallback(() => {
    const unit = buildUnit();
    if (!unit) {
      return false;
    }
    setCustomUnits((prev) => [...prev, unit]);
    setSelectedUnitKeys((prev) => [...prev, unit.key]);
    resetCustomUnitDraft();
    return true;
  }, [buildUnit, resetCustomUnitDraft]);

  return {
    selectedUnitKeys,
    overrides,
    unitNotes,
    customUnits,
    editingUnitKey,
    ownUnits,
    ownUnitKeys,
    customUnitDraft,
    initializedRef,
    savedHashRef,
    toggleUnitSelection,
    updateOverrideStat,
    clearUnitOverride,
    updateUnitNotes,
    toggleEditingUnit,
    removeCustomUnit,
    addCustomUnit,
  };
}

export type PrebattleConfig = ReturnType<typeof usePrebattleConfig>;
