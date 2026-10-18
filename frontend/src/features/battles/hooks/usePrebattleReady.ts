import { useCallback, useEffect, useState } from "react";

import {
  joinBattle,
  saveBattleParticipantConfig,
  setBattleReady,
} from "@/features/battles/api/battles-api";
import type { PrebattleConfig } from "@/features/battles/hooks/usePrebattleConfig";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";
import { buildConfigPayload } from "@/features/battles/utils/prebattle-config";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * Prebattle's own writes: accepting the invite, saving the form and Ready Up / Undo Ready, battle
 * notes, and joining prebattle once it opens. `actionError` is the line under the roster.
 */
export function usePrebattleReady({
  campaignId,
  battleId,
  battleState,
  currentParticipant,
  config,
  declaredRating,
  applyBattleResponse,
}: {
  campaignId: number;
  battleId: number;
  battleState: BattleState;
  currentParticipant: BattleParticipant | null;
  config: PrebattleConfig;
  declaredRating: number | null | undefined;
  applyBattleResponse: (next: BattleState) => void;
}) {
  const [actionError, setActionError] = useState("");
  const [isUpdatingReady, setIsUpdatingReady] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const currentUserReady = currentParticipant?.status === "ready";
  const { initializedRef, savedHashRef } = config;

  // An accepted invitee joins prebattle as soon as it opens.
  useEffect(() => {
    if (battleState.battle.status === "prebattle" && currentParticipant?.status === "accepted") {
      void joinBattle(campaignId, battleId)
        .then((next) => applyBattleResponse(next))
        .catch(() => undefined);
    }
  }, [applyBattleResponse, battleId, battleState, campaignId, currentParticipant]);

  const payloadFor = useCallback(
    (participant: BattleParticipant, battleNotes: string) =>
      buildConfigPayload(participant.unit_information_json, {
        allUnits: config.ownUnits,
        customUnits: config.customUnits,
        selectedKeys: config.selectedUnitKeys,
        overrides: config.overrides,
        notes: config.unitNotes,
        declaredRating,
        battleNotes,
      }),
    [
      config.customUnits,
      config.overrides,
      config.ownUnits,
      config.selectedUnitKeys,
      config.unitNotes,
      declaredRating,
    ]
  );

  /** Saves the form unless it is what the server has; false when the save failed. */
  const persistParticipantConfig = useCallback(async () => {
    if (!currentParticipant || !initializedRef.current) {
      return true;
    }
    const payload = payloadFor(currentParticipant, currentParticipant.battle_notes ?? "");
    const payloadHash = JSON.stringify(payload);
    if (payloadHash === savedHashRef.current) {
      return true;
    }
    setIsSavingConfig(true);
    try {
      applyBattleResponse(await saveBattleParticipantConfig(campaignId, battleId, payload));
      savedHashRef.current = payloadHash;
      return true;
    } catch (errorResponse) {
      setActionError(getErrorMessage(errorResponse, "Unable to save unit config"));
      return false;
    } finally {
      setIsSavingConfig(false);
    }
  }, [
    applyBattleResponse,
    battleId,
    campaignId,
    currentParticipant,
    initializedRef,
    payloadFor,
    savedHashRef,
  ]);

  const saveBattleNotes = useCallback(
    async (battleNotes: string) => {
      if (!currentParticipant || !initializedRef.current) {
        return;
      }
      const payload = payloadFor(currentParticipant, battleNotes);
      applyBattleResponse(await saveBattleParticipantConfig(campaignId, battleId, payload));
      savedHashRef.current = JSON.stringify(payload);
    },
    [
      applyBattleResponse,
      battleId,
      campaignId,
      currentParticipant,
      initializedRef,
      payloadFor,
      savedHashRef,
    ]
  );

  const acceptInvite = async () => {
    setIsAcceptingInvite(true);
    setActionError("");
    try {
      applyBattleResponse(await joinBattle(campaignId, battleId));
    } catch (errorResponse) {
      setActionError(getErrorMessage(errorResponse, "Unable to accept invitation"));
    } finally {
      setIsAcceptingInvite(false);
    }
  };

  const toggleReady = async () => {
    if (!currentParticipant) {
      return;
    }
    const targetReady = !currentUserReady;
    if (targetReady && !config.ownUnitKeys.some((key) => config.selectedUnitKeys.includes(key))) {
      setActionError("Select at least one unit to bring into battle.");
      return;
    }
    setIsUpdatingReady(true);
    setActionError("");
    try {
      if (targetReady && !(await persistParticipantConfig())) {
        return;
      }
      applyBattleResponse(await setBattleReady(campaignId, battleId, targetReady));
    } catch (errorResponse) {
      setActionError(getErrorMessage(errorResponse, "Unable to update ready state"));
    } finally {
      setIsUpdatingReady(false);
    }
  };

  return {
    actionError,
    setActionError,
    currentUserReady,
    isUpdatingReady,
    isSavingConfig,
    isAcceptingInvite,
    acceptInvite,
    toggleReady,
    saveBattleNotes,
  };
}
