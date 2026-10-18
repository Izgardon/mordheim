import { useCallback, useEffect, useMemo, useState } from "react";

import {
  explorationAmount,
  suggestedExploration,
} from "@/features/battles/components/postbattle/postbattle-rules";
import {
  getSelectedExplorationDiceValues,
  setLocalExplorationDiceCount,
  setLocalExplorationResource,
  settledExplorationPayload,
  type LocalExplorationState,
} from "@/features/battles/components/postbattle/postbattle-utils";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import { useLatestRef } from "@/features/battles/hooks/useLatestRef";
import type { PostbattleDraft } from "@/features/battles/hooks/usePostbattleDraft";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";
import { toD6Values } from "@/features/battles/utils/dice-results";
import type { WarbandResource } from "@/features/warbands/types/warband-types";

/**
 * The exploration roll: restored from the draft (or the suggested dice), rolled or typed in, and
 * saved with the draft as soon as every die is set, so a reload keeps it and allows no free
 * re-roll; changing saved dice is a re-roll the server warns about and logs (decision 9).
 */
export function useExploration({
  battleState,
  currentParticipant,
  currentRoster,
  resources,
  drafting,
}: {
  battleState: BattleState;
  currentParticipant: BattleParticipant | null;
  currentRoster: ParticipantRoster | undefined;
  resources: WarbandResource[];
  drafting: PostbattleDraft;
}) {
  const { draft, persistDraft, setDraftError } = drafting;
  const { lastSettledExplorationRef, savedExplorationKeyRef } = drafting;
  const [exploration, setExploration] = useState<LocalExplorationState | null>(null);
  const [explorationKey, setExplorationKey] = useState<string | null>(null);
  const [rollSignal, setRollSignal] = useState(0);
  const [rerollSignal, setRerollSignal] = useState(0);
  const [rerollIndex, setRerollIndex] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const participantRef = useLatestRef(currentParticipant);
  const { battle } = battleState;
  useEffect(() => {
    const participant = participantRef.current;
    if (!participant || !currentRoster) {
      return;
    }
    const ownerKey = `${battle.id}:${participant.id}`;
    if (explorationKey !== ownerKey) {
      const restored = suggestedExploration(participant, currentRoster, battle, resources);
      const saved = settledExplorationPayload(restored);
      savedExplorationKeyRef.current = saved ? JSON.stringify(saved) : null;
      lastSettledExplorationRef.current = saved;
      setExploration(restored);
      setExplorationKey(ownerKey);
      return;
    }
    if (exploration && exploration.resourceId === null && resources.length > 0) {
      const treasureId =
        resources.find((r) => r.name.toLowerCase() === "treasure")?.id ?? resources[0].id;
      setExploration(setLocalExplorationResource(exploration, treasureId));
    }
  }, [
    battle,
    currentParticipant?.id,
    currentParticipant?.unit_information_json,
    currentRoster,
    exploration,
    explorationKey,
    lastSettledExplorationRef,
    participantRef,
    resources,
    savedExplorationKeyRef,
  ]);

  const settledExploration = useMemo(() => settledExplorationPayload(exploration), [exploration]);
  const settledExplorationKey = settledExploration ? JSON.stringify(settledExploration) : null;
  useEffect(() => {
    if (!settledExploration) {
      return;
    }
    lastSettledExplorationRef.current = settledExploration;
    if (!draft || settledExplorationKey === savedExplorationKeyRef.current) {
      return;
    }
    savedExplorationKeyRef.current = settledExplorationKey;
    void persistDraft(draft);
  }, [
    draft,
    lastSettledExplorationRef,
    persistDraft,
    savedExplorationKeyRef,
    settledExploration,
    settledExplorationKey,
  ]);

  const rollAll = useCallback(() => {
    setDraftError("");
    setRerollIndex(null);
    setRollSignal((prev) => prev + 1);
  }, [setDraftError]);

  const reroll = useCallback(
    (index: number) => {
      setDraftError("");
      setRerollIndex(index);
      setRerollSignal((prev) => prev + 1);
    },
    [setDraftError]
  );

  const completeRoll = useCallback(
    (results: unknown) => {
      setIsRolling(false);
      setExploration((current) => {
        if (!current) {
          return current;
        }
        const nextValues = toD6Values(results, current.diceCount);
        if (nextValues.length === 0) {
          setDraftError("Unable to read exploration roll.");
          return current;
        }
        return {
          ...current,
          hasRolledAllDice: true,
          diceValues: current.diceValues.map((value, index) => nextValues[index] ?? value),
        };
      });
    },
    [setDraftError]
  );

  const completeReroll = useCallback(
    (results: unknown) => {
      setIsRolling(false);
      setExploration((current) => {
        if (!current || rerollIndex === null) {
          return current;
        }
        const [nextValue] = toD6Values(results, 1);
        if (!nextValue) {
          setDraftError("Unable to read exploration roll.");
          return current;
        }
        return {
          ...current,
          diceValues: current.diceValues.map((value, index) =>
            index === rerollIndex ? nextValue : value
          ),
        };
      });
      setRerollIndex(null);
    },
    [rerollIndex, setDraftError]
  );

  const commitDiceCount = useCallback(
    (nextCount: number) => {
      if (exploration) {
        setExploration(setLocalExplorationDiceCount(exploration, nextCount));
      }
    },
    [exploration]
  );

  const amountFromDice = useMemo(
    () => explorationAmount(exploration ? getSelectedExplorationDiceValues(exploration) : []),
    [exploration]
  );
  const resource = useMemo(
    () => resources.find((entry) => entry.id === exploration?.resourceId) ?? null,
    [exploration?.resourceId, resources]
  );

  return {
    exploration,
    setExploration,
    amountFromDice,
    amount: exploration?.amountOverride ?? amountFromDice,
    resource,
    rollSignal,
    rerollSignal,
    rerollIndex,
    isRolling,
    setIsRolling,
    rollAll,
    reroll,
    completeRoll,
    completeReroll,
    commitDiceCount,
  };
}

export type ExplorationState = ReturnType<typeof useExploration>;
