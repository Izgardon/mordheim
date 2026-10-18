import { useMemo } from "react";

import {
  toUnitInformationMap,
  unitInformationMapToNotes,
  unitInformationMapToOverrides,
} from "@/features/battles/components/active/active-utils";
import type {
  PrebattleUnit,
  UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import { normalizeCustomUnits } from "@/features/battles/components/prebattle/prebattle-utils";
import type { PrebattleConfig } from "@/features/battles/hooks/usePrebattleConfig";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

const NO_UNITS: PrebattleUnit[] = [];
const NO_KEYS: string[] = [];
const NO_OVERRIDES: Record<string, UnitOverride> = {};
const NO_NOTES: Record<string, string> = {};

/**
 * What prebattle shows for the selected warband: your own form while it's yours, the other
 * player's saved config otherwise.
 */
export function usePrebattleVisibleConfig(
  participant: BattleParticipant | null,
  isOwn: boolean,
  config: PrebattleConfig
) {
  const customUnits = useMemo(() => {
    if (!participant) {
      return NO_UNITS;
    }
    return isOwn ? config.customUnits : normalizeCustomUnits(participant.custom_units_json);
  }, [config.customUnits, isOwn, participant]);

  const selectedKeys = useMemo(() => {
    if (!participant) {
      return NO_KEYS;
    }
    return isOwn ? config.selectedUnitKeys : participant.selected_unit_keys_json || [];
  }, [config.selectedUnitKeys, isOwn, participant]);

  const overrides = useMemo(() => {
    if (!participant) {
      return NO_OVERRIDES;
    }
    const saved = unitInformationMapToOverrides(
      toUnitInformationMap(participant.unit_information_json)
    );
    return isOwn ? config.overrides : saved;
  }, [config.overrides, isOwn, participant]);

  const notes = useMemo(() => {
    if (!participant) {
      return NO_NOTES;
    }
    const saved = unitInformationMapToNotes(
      toUnitInformationMap(participant.unit_information_json)
    );
    return isOwn ? config.unitNotes : saved;
  }, [config.unitNotes, isOwn, participant]);

  return { customUnits, selectedKeys, overrides, notes };
}
