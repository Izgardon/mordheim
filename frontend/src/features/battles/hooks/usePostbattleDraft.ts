import { useCallback, useEffect, useRef, useState } from "react";

import { saveBattlePostbattleDraft } from "@/features/battles/api/battles-api";
import { suggestedDraft } from "@/features/battles/components/postbattle/postbattle-rules";
import type { settledExplorationPayload } from "@/features/battles/components/postbattle/postbattle-utils";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import { useLatestRef } from "@/features/battles/hooks/useLatestRef";
import { useSerializedSave } from "@/features/battles/hooks/useSerializedSave";
import type {
  BattleParticipant,
  BattlePostbattleState,
  BattleState,
} from "@/features/battles/types/battle-types";
import { toastBattleWarnings } from "@/features/battles/utils/battle-warnings";
import type { WarbandResource } from "@/features/warbands/types/warband-types";
import { getErrorMessage } from "@/lib/get-error-message";

export type SettledExploration = ReturnType<typeof settledExplorationPayload>;

/**
 * Your postbattle draft: rebuilt from the server's copy when it or the battle changes, saved one
 * at a time with the latest settled exploration roll (BUG-44, BUG-71). `persistDraft` shows an
 * edit at once and saves it.
 */
export function usePostbattleDraft({
  campaignId,
  battleId,
  battleState,
  currentParticipant,
  currentRoster,
  resources,
  applyBattleResponse,
}: {
  campaignId: number;
  battleId: number;
  battleState: BattleState;
  currentParticipant: BattleParticipant | null;
  currentRoster: ParticipantRoster | undefined;
  resources: WarbandResource[];
  applyBattleResponse: (next: BattleState) => void;
}) {
  const [draft, setDraft] = useState<BattlePostbattleState | null>(null);
  const [draftError, setDraftError] = useState("");
  // Drafts keep the exploration roll (BUG-71): the latest one with every die set.
  const lastSettledExplorationRef = useRef<SettledExploration>(null);
  const savedExplorationKeyRef = useRef<string | null>(null);

  // Rebuilt only when what the draft is built from changes, not on every participant update.
  const participantRef = useLatestRef(currentParticipant);
  const { battle, suggested_postbattle: suggestion } = battleState;
  useEffect(() => {
    const participant = participantRef.current;
    if (!participant || !currentRoster) return;
    setDraft(suggestedDraft(participant, currentRoster, resources, suggestion));
  }, [
    battle,
    suggestion,
    currentParticipant?.id,
    currentParticipant?.postbattle_json,
    currentParticipant?.unit_information_json,
    currentParticipant?.selected_unit_keys_json,
    currentRoster,
    participantRef,
    resources,
  ]);

  const sendDraft = useCallback(
    (nextDraft: BattlePostbattleState) =>
      saveBattlePostbattleDraft(campaignId, battleId, {
        postbattle_json: {
          exploration: lastSettledExplorationRef.current ?? { dice_values: [], resource_id: null },
          finds: nextDraft.finds,
          upkeep: nextDraft.upkeep,
          unit_results: nextDraft.unit_results,
          ...(nextDraft.mount_survival ? { mount_survival: nextDraft.mount_survival } : {}),
        },
      }),
    [battleId, campaignId]
  );
  const applyDraftAnswer = useCallback(
    (next: BattleState) => {
      applyBattleResponse(next);
      toastBattleWarnings(next.warnings); // a re-roll or an unusual number went ahead
    },
    [applyBattleResponse]
  );
  // One draft save at a time, newest last, as active config does: an older answer can't undo a
  // newer edit (BUG-44).
  const { save: queueDraftSave, isSaving: isSavingDraft } = useSerializedSave(
    sendDraft,
    applyDraftAnswer
  );

  const persistDraft = useCallback(
    async (nextDraft: BattlePostbattleState) => {
      setDraft(nextDraft);
      setDraftError("");
      try {
        await queueDraftSave(nextDraft);
      } catch (errorResponse) {
        setDraftError(getErrorMessage(errorResponse, "Unable to save postbattle draft"));
      }
    },
    [queueDraftSave]
  );

  return {
    draft,
    draftError,
    setDraftError,
    isSavingDraft,
    persistDraft,
    lastSettledExplorationRef,
    savedExplorationKeyRef,
  };
}

export type PostbattleDraft = ReturnType<typeof usePostbattleDraft>;
