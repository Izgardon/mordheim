import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  addNeutralGroup,
  changeNeutralCreature,
  changeNeutralGroup,
  changeRound,
  recordUnitKill,
  setUnitDismounted,
  setUnitOutOfAction,
  type KillHow,
  type NeutralCreaturesInput,
  type RoundAction,
} from "@/features/battles/api/battles-api";
import {
  battleSections,
  battleSides,
  type UnitStatus,
} from "@/features/battles/components/battle/battle-units";
import { useActiveConfigSave } from "@/features/battles/hooks/useActiveConfigSave";
import { useCreatorCancel } from "@/features/battles/hooks/useCreatorCancel";
import { useEventUndo } from "@/features/battles/hooks/useEventUndo";
import { useFinishMine } from "@/features/battles/hooks/useFinishMine";
import {
  useSingleUseItemActions,
  useUsedSingleUseItems,
} from "@/features/battles/hooks/useUsedSingleUseItems";
import { useBattle } from "@/features/battles/state/battle-context";
import type { BattleCreatureStatus, BattleState } from "@/features/battles/types/battle-types";
import { battleFeed } from "@/features/battles/utils/battle-feed";
import { newestOwnEvent } from "@/features/battles/utils/battle-events";
import { getErrorMessage } from "@/lib/get-error-message";

/** Who a kill took out: a model of another warband, a neutral creature, or a name typed in. */
export type KillVictim = { unitKey: string } | { neutralKey: string } | { name: string };

export type KillInput = {
  killerUnitKey: string;
  victim: KillVictim;
  how: KillHow;
  earnedXp: boolean;
};

/**
 * Everything the battle screen shows and does, from the battle the layout
 * shares: your units by section, the strip's sides, the feed, and the writes. Status cycles go
 * through config/ (knocked down, stunned) and unit-ooa/ (out of action, so kills, moments and the
 * post-game keep working); kills, rounds and neutral groups through their own endpoints. Every
 * answer is merged into the cached battle; the others get it over the battle channel.
 */
export function useBattleScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const battle = useBattle();
  const { campaignId, battleId, battleState, applyBattleResponse, rosters, capabilities } = battle;
  const { participants, events } = battleState;
  const userId = user?.id;
  const me = participants.find((entry) => entry.user.id === userId) ?? null;
  const round = battleState.battle.round ?? 1;
  const neutralGroups = useMemo(
    () => battleState.battle.neutral_groups ?? [],
    [battleState.battle.neutral_groups]
  );

  const config = useActiveConfigSave({ battle, userId, rosters });
  const getUsedSingleUseItemCount = useUsedSingleUseItems(events);
  const items = useSingleUseItemActions({
    campaignId,
    battleId,
    events,
    currentParticipant: me,
    userId,
    applyBattleResponse,
    setActionError: config.setActionError,
  });
  const { undo, offerUndo } = useEventUndo({ campaignId, battleId, applyBattleResponse });
  const finishing = useFinishMine({ campaignId, battleId, applyBattleResponse });
  const creatorCancel = useCreatorCancel({ campaignId, battleId, applyBattleResponse });

  const myRoster = me ? rosters[me.user.id] : undefined;
  const sections = useMemo(() => (me ? battleSections(me, myRoster) : null), [me, myRoster]);
  const sides = useMemo(
    () => battleSides(participants, rosters, neutralGroups, userId),
    [neutralGroups, participants, rosters, userId]
  );
  const feed = useMemo(
    () => battleFeed(events, participants, rosters, userId),
    [events, participants, rosters, userId]
  );
  const canAct = battleState.battle.status === "active" && me?.status === "in_battle";

  /** Runs a battle write, merges its answer, and says so when it is refused. */
  const write = useCallback(
    async (run: () => Promise<BattleState>, failure: string) => {
      try {
        const next = await run();
        applyBattleResponse(next);
        return next;
      } catch (error) {
        toast.error(getErrorMessage(error, failure));
        return null;
      }
    },
    [applyBattleResponse]
  );

  const setOutOfAction = useCallback(
    (unitKey: string, outOfAction: boolean) =>
      write(
        () =>
          setUnitOutOfAction(campaignId, battleId, {
            unit_key: unitKey,
            out_of_action: outOfAction,
          }),
        "Couldn't change that."
      ),
    [battleId, campaignId, write]
  );

  /** A unit's status from `from` to `next`: the taps of a cycle sent as one (useBufferedStatus). */
  const setStatus = useCallback(
    async (key: string, from: UnitStatus, next: UnitStatus) => {
      if (next === "out_of_action") {
        await setOutOfAction(key, true);
        return;
      }
      if (from === "out_of_action" && !(await setOutOfAction(key, false))) return;
      if (next !== "standing" || (from !== "out_of_action" && from !== "standing")) {
        await config
          .saveUnitStatus(key, next === "standing" ? null : next)
          .catch((error) => toast.error(getErrorMessage(error, "Couldn't change that.")));
      }
    },
    [config, setOutOfAction]
  );

  const setDismounted = useCallback(
    (unitKey: string, dismounted: boolean) =>
      write(
        () => setUnitDismounted(campaignId, battleId, { unit_key: unitKey, dismounted }),
        "Couldn't change the mount."
      ),
    [battleId, campaignId, write]
  );

  const recordKill = useCallback(
    async (kill: KillInput) => {
      const next = await recordUnitKill(campaignId, battleId, {
        killer_unit_key: kill.killerUnitKey,
        ...("unitKey" in kill.victim ? { victim_unit_key: kill.victim.unitKey } : {}),
        ...("neutralKey" in kill.victim ? { victim_neutral_key: kill.victim.neutralKey } : {}),
        ...("name" in kill.victim ? { victim_name: kill.victim.name } : {}),
        how: kill.how,
        earned_xp: kill.earnedXp,
      });
      applyBattleResponse(next);
      // A mis-tapped kill can be undone at once, from the feed, or from postbattle (BUG-11).
      offerUndo("Kill logged.", newestOwnEvent(next.events, "unit_kill_recorded", userId)?.id);
    },
    [applyBattleResponse, battleId, campaignId, offerUndo, userId]
  );

  const changeTheRound = useCallback(
    (action: RoundAction) =>
      write(() => changeRound(campaignId, battleId, action), "Couldn't change the round."),
    [battleId, campaignId, write]
  );

  /** A neutral group by its name alone: it starts empty, and Add a unit fills it. */
  const addGroup = useCallback(
    async (name: string) => {
      applyBattleResponse(await addNeutralGroup(campaignId, battleId, { name }));
    },
    [applyBattleResponse, battleId, campaignId]
  );

  /** Creatures of one type in a neutral group; throws when refused, so the sheet shows why. */
  const addCreatures = useCallback(
    async (groupKey: string, creatures: NeutralCreaturesInput) => {
      applyBattleResponse(
        await changeNeutralGroup(campaignId, battleId, groupKey, { add: creatures })
      );
    },
    [applyBattleResponse, battleId, campaignId]
  );

  const removeGroup = useCallback(
    (groupKey: string) =>
      write(
        () => changeNeutralGroup(campaignId, battleId, groupKey, { remove: true }),
        "Couldn't take the group away."
      ),
    [battleId, campaignId, write]
  );

  const changeCreature = useCallback(
    (creatureKey: string, change: { status?: BattleCreatureStatus; wounds?: number }) =>
      write(
        () => changeNeutralCreature(campaignId, battleId, creatureKey, change),
        "Couldn't change the creature."
      ),
    [battleId, campaignId, write]
  );

  const leave = useCallback(() => navigate(`/campaigns/${campaignId}`), [campaignId, navigate]);

  return {
    user,
    battle,
    me,
    round,
    neutralGroups,
    sections,
    sides,
    feed,
    canAct,
    config,
    items,
    getUsedSingleUseItemCount,
    undo,
    finishing,
    creatorCancel,
    setStatus,
    setDismounted,
    recordKill,
    changeTheRound,
    addGroup,
    addCreatures,
    removeGroup,
    changeCreature,
    leave,
    // The server's capabilities decide Finish my battle and Cancel; without them, today's rules.
    canFinishMine: capabilities ? Boolean(capabilities.finish_mine) : canAct,
    canCancelBattle: capabilities
      ? capabilities.cancel
      : battleState.battle.created_by_user_id === userId,
    // Start anyway: the creator or a battle manager still fighting (William); the others ask and agree.
    canForceRound:
      canAct &&
      (capabilities
        ? Boolean(capabilities.force_round)
        : battleState.battle.created_by_user_id === userId),
  };
}

export type BattleScreen = ReturnType<typeof useBattleScreen>;
