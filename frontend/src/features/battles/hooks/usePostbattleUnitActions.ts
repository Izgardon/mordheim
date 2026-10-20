import { useCallback, useEffect, useMemo, useState } from "react";

import { recordUnitKill } from "@/features/battles/api/battles-api";
import { buildBattleUnitOptions } from "@/features/battles/components/active/active-utils";
import { seriousInjuryRoll } from "@/features/battles/components/postbattle/postbattle-rules";
import {
  setPostbattlePayUpkeep,
  updateGroupXp,
  updatePostbattleUpkeepEntry,
  updateUnitResult,
  type PostbattleRenderableRow,
} from "@/features/battles/components/postbattle/postbattle-utils";
import type { InjuryRollTarget } from "@/features/battles/components/postbattle/SeriousInjuryRollDialog";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import { useEventUndo } from "@/features/battles/hooks/useEventUndo";
import type { PostbattleDraft } from "@/features/battles/hooks/usePostbattleDraft";
import type { BattlePostbattleRules, BattleState } from "@/features/battles/types/battle-types";
import { parseDiceValues } from "@/features/battles/utils/dice-results";

type KillInput = { victimUnitKey?: string; victimName?: string; notes?: string; earnedXp: boolean };

/**
 * What a postbattle row changes: XP, the Dead tick, serious-injury rolls and their Apply tick,
 * kept stat changes, kills, and the hired swords' upkeep. Draft edits save through `persistDraft`.
 */
export function usePostbattleUnitActions({
  campaignId,
  battleId,
  battleState,
  rosters,
  userId,
  rules,
  drafting,
  applyBattleResponse,
}: {
  campaignId: number;
  battleId: number;
  battleState: BattleState;
  rosters: Record<number, ParticipantRoster>;
  userId: number | undefined;
  rules: BattlePostbattleRules | undefined;
  drafting: PostbattleDraft;
  applyBattleResponse: (next: BattleState) => void;
}) {
  const { draft, persistDraft, setDraftError } = drafting;
  const [rollTarget, setRollTarget] = useState<InjuryRollTarget>(null);
  const [isInjuryRolling, setIsInjuryRolling] = useState(false);

  useEffect(() => {
    if (!rollTarget) {
      setIsInjuryRolling(false);
    }
  }, [rollTarget]);

  const toggleDead = useCallback(
    async (row: PostbattleRenderableRow, checked: boolean) => {
      if (!draft) return;
      await persistDraft(
        updateUnitResult(draft, row.unitKey, (current) => ({ ...current, dead: checked }))
      );
    },
    [draft, persistDraft]
  );

  const rollSeriousInjury = useCallback(
    async (results: unknown) => {
      if (!draft || !rollTarget) return;
      const values = parseDiceValues(results);
      if (values.length === 0) {
        setDraftError("Unable to read serious injury roll.");
        return;
      }
      const roll = seriousInjuryRoll(rollTarget.unitKind, values, rules);
      setIsInjuryRolling(false);
      setRollTarget(null);
      await persistDraft(
        updateUnitResult(draft, rollTarget.unitKey, (current) => ({
          ...current,
          dead: roll.dead_suggestion ? true : current.dead,
          serious_injury_rolls: [...current.serious_injury_rolls, roll],
        }))
      );
    },
    [draft, persistDraft, rollTarget, rules, setDraftError]
  );

  /** Only the unit's last roll counts; its effect is applied at finalise when ticked (BUG-47). */
  const toggleInjuryApply = useCallback(
    (row: PostbattleRenderableRow, apply: boolean) => {
      if (!draft) return;
      const lastIndex = row.seriousInjuryRolls.length - 1;
      void persistDraft(
        updateUnitResult(draft, row.unitKey, (current) => ({
          ...current,
          serious_injury_rolls: current.serious_injury_rolls.map((roll, index) =>
            index === lastIndex ? { ...roll, apply } : roll
          ),
        }))
      );
    },
    [draft, persistDraft]
  );

  /** Battle stat changes are kept only when ticked; one tick per henchmen group (SEC-10). */
  const toggleKeepStats = useCallback(
    (unitKeys: string[], keep: boolean) => {
      if (!draft) return;
      void persistDraft(
        unitKeys.reduce(
          (next, unitKey) =>
            updateUnitResult(next, unitKey, (current) => ({ ...current, keep_stats: keep })),
          draft
        )
      );
    },
    [draft, persistDraft]
  );

  const commitUnitXp = useCallback(
    (unitKey: string, nextXp: number) => {
      if (!draft || draft.unit_results[unitKey]?.xp_earned === nextXp) return;
      void persistDraft(
        updateUnitResult(draft, unitKey, (current) => ({ ...current, xp_earned: nextXp }))
      );
    },
    [draft, persistDraft]
  );

  const commitGroupXp = useCallback(
    (groupKey: string, nextXp: number) => {
      if (!draft) return;
      const matchingResult = Object.values(draft.unit_results).find(
        (result) => result.unit_kind === "henchman" && result.group_name === groupKey
      );
      if (matchingResult?.xp_earned === nextXp) return;
      void persistDraft(updateGroupXp(draft, groupKey, nextXp));
    },
    [draft, persistDraft]
  );

  const commitUpkeepCost = useCallback(
    (unitKey: string, nextCost: number) => {
      if (!draft || draft.upkeep.entries[unitKey]?.cost === nextCost) return;
      void persistDraft(updatePostbattleUpkeepEntry(draft, unitKey, nextCost));
    },
    [draft, persistDraft]
  );

  const togglePayUpkeep = useCallback(
    (checked: boolean) => {
      if (!draft || draft.upkeep.pay_upkeep === checked) return;
      void persistDraft(setPostbattlePayUpkeep(draft, checked));
    },
    [draft, persistDraft]
  );

  // Kills are the kill events that still count, the number finalise applies (BUG-11): Plus records
  // one more (source postbattle), Minus undoes the latest. The draft's kill_count is ignored.
  const killTargetOptions = useMemo(
    () =>
      buildBattleUnitOptions(battleState.participants, rosters).filter(
        (option) => option.participantUserId !== userId
      ),
    [battleState.participants, rosters, userId]
  );
  const { undo: undoKill } = useEventUndo({ campaignId, battleId, applyBattleResponse });
  const addKill = useCallback(
    async (unitKey: string, kill: KillInput) => {
      const next = await recordUnitKill(campaignId, battleId, {
        killer_unit_key: unitKey,
        victim_unit_key: kill.victimUnitKey,
        victim_name: kill.victimName,
        notes: kill.notes,
        earned_xp: kill.earnedXp,
        source: "postbattle",
      });
      applyBattleResponse(next);
    },
    [applyBattleResponse, battleId, campaignId]
  );

  return {
    rollTarget,
    setRollTarget,
    isInjuryRolling,
    setIsInjuryRolling,
    toggleDead,
    rollSeriousInjury,
    toggleInjuryApply,
    toggleKeepStats,
    commitUnitXp,
    commitGroupXp,
    commitUpkeepCost,
    togglePayUpkeep,
    killTargetOptions,
    addKill,
    undoKill,
  };
}

export type PostbattleUnitActions = ReturnType<typeof usePostbattleUnitActions>;
