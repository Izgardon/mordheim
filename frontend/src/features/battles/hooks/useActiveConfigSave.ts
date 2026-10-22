import { useCallback, useState } from "react";

import { saveBattleParticipantConfig } from "@/features/battles/api/battles-api";
import {
  getCurrentUnitWounds,
  getParticipantSelectedUnits,
  setUnitCurrentWounds,
  toUnitInformationMap,
  updateUnitInformationOverride,
} from "@/features/battles/components/active/active-utils";
import type {
  ParticipantRoster,
  PrebattleUnit,
  UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import {
  normalizeCustomUnits,
  serializeCustomUnits,
} from "@/features/battles/components/prebattle/prebattle-utils";
import { useCustomUnitDraft } from "@/features/battles/hooks/useCustomUnitDraft";
import { useSerializedSave } from "@/features/battles/hooks/useSerializedSave";
import type { BattleContextValue } from "@/features/battles/state/battle-context";
import {
  applyConfigPatch,
  mergeConfigPatches,
  type ParticipantConfigPatch,
} from "@/features/battles/utils/unit-information-patch";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * The active page's config saves: wounds, stat changes, unit and battle notes, and temporary
 * units. Each is applied to the cached state at once and sent as the changed unit's patch only
 * (BUG-44), one save in flight; a unit stays locked (`savingUnitKeys`) until its save answers.
 */
export function useActiveConfigSave({
  battle,
  userId,
  rosters,
}: {
  battle: Pick<
    BattleContextValue,
    "campaignId" | "battleId" | "battleStateRef" | "applyBattleResponse" | "updateBattleState"
  >;
  userId: number | undefined;
  rosters: Record<number, ParticipantRoster>;
}) {
  const { campaignId, battleId, battleStateRef, applyBattleResponse, updateBattleState } = battle;
  const [actionError, setActionError] = useState("");
  const customUnitDraft = useCustomUnitDraft();
  const { buildUnit, reset: resetCustomUnitDraft } = customUnitDraft;

  const sendConfig = useCallback(
    (payload: ParticipantConfigPatch) => saveBattleParticipantConfig(campaignId, battleId, payload),
    [battleId, campaignId]
  );
  const {
    save: queueConfigSave,
    pendingKeys: savingUnitKeys,
    isSaving: isSavingConfig,
  } = useSerializedSave(sendConfig, applyBattleResponse, { merge: mergeConfigPatches });

  /** Your participant as cached now, optimistic changes included. */
  const ownParticipant = useCallback(
    () => battleStateRef.current?.participants.find((entry) => entry.user.id === userId) ?? null,
    [battleStateRef, userId]
  );

  const saveConfig = useCallback(
    async (
      payload: ParticipantConfigPatch,
      {
        savingUnitKeys = [],
        showGlobalSaving = true,
      }: { savingUnitKeys?: string[]; showGlobalSaving?: boolean } = {}
    ) => {
      if (!ownParticipant()) {
        return null;
      }
      updateBattleState((previous) =>
        previous
          ? {
              ...previous,
              participants: previous.participants.map((participant) =>
                participant.user.id === userId
                  ? applyConfigPatch(participant, payload)
                  : participant
              ),
            }
          : previous
      );
      if (showGlobalSaving) {
        setActionError("");
      }
      try {
        return await queueConfigSave(payload, {
          keys: savingUnitKeys,
          silent: !showGlobalSaving,
        });
      } catch (errorResponse) {
        if (showGlobalSaving) {
          setActionError(getErrorMessage(errorResponse, "Unable to save unit config"));
        }
        throw errorResponse;
      }
    },
    [ownParticipant, queueConfigSave, updateBattleState, userId]
  );

  const adjustUnitWounds = useCallback(
    async (unit: PrebattleUnit, delta: number) => {
      const participant = ownParticipant();
      if (delta === 0 || !participant) {
        return;
      }
      const unitInformation = toUnitInformationMap(participant.unit_information_json);
      const currentWounds = getCurrentUnitWounds(unit, unitInformation[unit.key]);
      const nextWounds = Math.max(0, Math.min(10, currentWounds + delta));
      if (nextWounds === currentWounds) {
        return;
      }
      const nextEntry = setUnitCurrentWounds(unitInformation, unit, nextWounds)[unit.key];
      await saveConfig(
        {
          unit_information_patch: {
            [unit.key]: { current_wounds: nextEntry?.current_wounds ?? null },
          },
        },
        { savingUnitKeys: [unit.key] }
      );
    },
    [ownParticipant, saveConfig]
  );

  /**
   * A battle stat change (BATL-NEW-07): one unit's, or every member's of a henchmen group, as one
   * patch. It stays temporary unless kept in postbattle (decision 6).
   */
  const saveUnitOverride = useCallback(
    async (unitKeys: string[], override: UnitOverride | undefined) => {
      const participant = ownParticipant();
      if (!participant || unitKeys.length === 0) {
        return;
      }
      const selected = getParticipantSelectedUnits(participant, rosters[participant.user.id]);
      const units = [
        ...selected.heroes,
        ...selected.henchmen,
        ...selected.hirelings,
        ...selected.temporary,
      ];
      const unitInformation = toUnitInformationMap(participant.unit_information_json);
      const patch: NonNullable<ParticipantConfigPatch["unit_information_patch"]> = {};
      for (const unitKey of unitKeys) {
        const unit = units.find((entry) => entry.key === unitKey);
        if (!unit) {
          throw new Error("Unable to find unit for active edit");
        }
        const nextEntry = updateUnitInformationOverride(unitInformation, unit, override)[unitKey];
        patch[unitKey] = { stats_override: nextEntry?.stats_override ?? {} };
      }
      await saveConfig({ unit_information_patch: patch }, { savingUnitKeys: unitKeys });
    },
    [ownParticipant, rosters, saveConfig]
  );

  const saveUnitNotes = useCallback(
    async (unitKey: string, notes: string) => {
      await saveConfig(
        { unit_information_patch: { [unitKey]: { notes } } },
        { savingUnitKeys: [unitKey], showGlobalSaving: false }
      );
    },
    [saveConfig]
  );

  const saveBattleNotes = useCallback(
    async (battleNotes: string) => {
      await saveConfig({ battle_notes: battleNotes }, { showGlobalSaving: false });
    },
    [saveConfig]
  );

  const addCustomUnit = useCallback(async () => {
    const participant = ownParticipant();
    if (!participant) {
      return;
    }
    const unit = buildUnit();
    if (!unit) {
      return;
    }
    const nextCustomUnits = [...normalizeCustomUnits(participant.custom_units_json), unit];
    try {
      const next = await saveConfig({
        selected_unit_keys_json: Array.from(
          new Set([...(participant.selected_unit_keys_json ?? []), unit.key])
        ),
        custom_units_json: serializeCustomUnits(nextCustomUnits),
      });
      if (next) {
        resetCustomUnitDraft();
      }
    } catch {
      return;
    }
  }, [buildUnit, ownParticipant, resetCustomUnitDraft, saveConfig]);

  return {
    actionError,
    setActionError,
    isSavingConfig,
    savingUnitKeys,
    customUnitDraft,
    adjustUnitWounds,
    saveUnitOverride,
    saveUnitNotes,
    saveBattleNotes,
    addCustomUnit,
  };
}
