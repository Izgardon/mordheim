import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  explorationAmount,
  explorationDiceLimits,
  suggestedExploration,
} from "@/features/battles/components/postbattle/postbattle-rules";
import {
  defaultResourceId,
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
import type { WarbandResource } from "@/features/warbands/types/warband-types";

/**
 * The exploration roll: restored from the draft (or the suggested dice), rolled or typed in, and
 * saved with the draft as soon as every die is set, so a reload keeps it and allows no free
 * re-roll; changing a saved die is a re-roll the server warns about and logs (decision 9), and it
 * never moves what the explore step has already handed over.
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
  const participantRef = useLatestRef(currentParticipant);
  const { battle, rules, suggested_postbattle: suggestion } = battleState;
  const limits = explorationDiceLimits(rules);
  // Seeded before the server's suggestion arrived (it comes with a read or a broadcast): seed
  // again once it does, while no die is set (the "Dice Count 0" after End battle).
  const seededWithoutSuggestionRef = useRef(false);
  useEffect(() => {
    const participant = participantRef.current;
    if (!participant || !currentRoster) {
      return;
    }
    const ownerKey = `${battle.id}:${participant.id}`;
    const untouched = exploration?.diceValues.every((value) => value === null) ?? false;
    const lateSuggestion = Boolean(suggestion) && seededWithoutSuggestionRef.current && untouched;
    if (explorationKey !== ownerKey || lateSuggestion) {
      const restored = suggestedExploration(participant, resources, suggestion, rules);
      const saved = settledExplorationPayload(restored);
      savedExplorationKeyRef.current = saved ? JSON.stringify(saved) : null;
      lastSettledExplorationRef.current = saved;
      seededWithoutSuggestionRef.current = !suggestion;
      setExploration(restored);
      setExplorationKey(ownerKey);
      return;
    }
    // none picked, or the pick is gone (deleted, or merged into the default by a campaign rename)
    const gone = !resources.some((resource) => resource.id === exploration?.resourceId);
    if (exploration && gone && resources.length > 0) {
      setExploration(setLocalExplorationResource(exploration, defaultResourceId(resources)));
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
    rules,
    savedExplorationKeyRef,
    suggestion,
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

  /** One die rolled again or typed over: the rest of the roll stays exactly as it was thrown. */
  const setDie = useCallback(
    (index: number, face: number) => {
      setDraftError("");
      setExploration((current) =>
        current
          ? {
              ...current,
              hasRolledAllDice: true,
              diceValues: current.diceValues.map((value, at) => (at === index ? face : value)),
            }
          : current
      );
    },
    [setDraftError]
  );

  const commitDiceCount = useCallback(
    (nextCount: number) => {
      if (exploration) {
        setExploration(setLocalExplorationDiceCount(exploration, nextCount, limits));
      }
    },
    [exploration, limits]
  );

  const amountFromDice = useMemo(
    () =>
      explorationAmount(rules, exploration ? getSelectedExplorationDiceValues(exploration) : []),
    [exploration, rules]
  );
  const resource = useMemo(
    () => resources.find((entry) => entry.id === exploration?.resourceId) ?? null,
    [exploration?.resourceId, resources]
  );

  // the dice as they stand: every one of them has a face, so the roll has happened
  const rolled = Boolean(
    exploration && exploration.diceValues.length > 0 && settledExploration !== null
  );

  return {
    exploration,
    setExploration,
    rolled,
    rules,
    limits,
    amountFromDice,
    amount: exploration?.amountOverride ?? amountFromDice,
    resource,
    setDie,
    commitDiceCount,
  };
}

export type ExplorationState = ReturnType<typeof useExploration>;
