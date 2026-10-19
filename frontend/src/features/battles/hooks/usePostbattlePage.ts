import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { saveBattleParticipantConfig } from "@/features/battles/api/battles-api";
import { heroDeathRollFor } from "@/features/battles/components/postbattle/postbattle-rules";
import type { PostbattleRowTools } from "@/features/battles/components/postbattle/postbattle-row-tools";
import { buildStatChangeRows } from "@/features/battles/components/postbattle/stat-changes";
import {
  buildFinalizeSummary,
  buildUpkeepRows,
} from "@/features/battles/components/postbattle/postbattle-summary";
import {
  buildRenderableGroups,
  getPostbattleUpkeepTotal,
  isPostbattleDraftValid,
} from "@/features/battles/components/postbattle/postbattle-utils";
import { flattenRosterUnits } from "@/features/battles/components/prebattle/prebattle-utils";
import { useExploration } from "@/features/battles/hooks/useExploration";
import { useFindItemSearch } from "@/features/battles/hooks/useFindItemSearch";
import { usePostbattleDraft } from "@/features/battles/hooks/usePostbattleDraft";
import { usePostbattleExit } from "@/features/battles/hooks/usePostbattleExit";
import { usePostbattleUnitActions } from "@/features/battles/hooks/usePostbattleUnitActions";
import { useBattle } from "@/features/battles/state/battle-context";
import type { BattleEvent } from "@/features/battles/types/battle-types";
import { liveKillEvents } from "@/features/battles/utils/battle-events";
import { killVictimName } from "@/features/battles/utils/kill-victims";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { warbandSheetQuery } from "@/features/warbands/api/warband-queries";
import type { WarbandResource } from "@/features/warbands/types/warband-types";

const NO_RESOURCES: WarbandResource[] = [];

/**
 * Everything the postbattle page shows and does, from the battle `BattleLayout` shares: the
 * draft and its exploration roll, each unit's results, finds, upkeep, the finalise summary and
 * the ways out.
 */
export function usePostbattlePage(campaign: CampaignSummary | null | undefined) {
  const { user } = useAuth();
  const battle = useBattle();
  const { campaignId, battleId, battleState, applyBattleResponse, rosters } = battle;
  const currentParticipant = useMemo(
    () => battleState.participants.find((participant) => participant.user.id === user?.id) ?? null,
    [battleState.participants, user?.id]
  );
  const ownUserId = currentParticipant?.user.id;
  const currentRoster = ownUserId !== undefined ? rosters[ownUserId] : undefined;

  // The warband's resources come from its cached sheet, the warband page's query (BUG-127),
  // instead of a request of their own on every visit.
  const warbandId = currentParticipant?.warband.id ?? null;
  const sheetQuery = useQuery({
    ...warbandSheetQuery(campaignId, warbandId ?? 0),
    enabled: warbandId !== null,
  });
  const resources = sheetQuery.data?.summary.resources ?? NO_RESOURCES;

  const drafting = usePostbattleDraft({
    campaignId,
    battleId,
    battleState,
    currentParticipant,
    currentRoster,
    resources,
    applyBattleResponse,
  });
  const explore = useExploration({
    battleState,
    currentParticipant,
    currentRoster,
    resources,
    drafting,
  });
  // Only a postbattle read carries the server's rules and suggestions (IMP-52): reached from Active
  // (a write's answer or a message), the page reads them once.
  const { rules, suggested_postbattle: suggestion } = battleState;
  const { refreshBattleState } = battle;
  const askedForRulesRef = useRef(false);
  useEffect(() => {
    if ((!rules || !suggestion) && !askedForRulesRef.current) {
      askedForRulesRef.current = true;
      void refreshBattleState();
    }
  }, [refreshBattleState, rules, suggestion]);
  const heroDeathRoll = heroDeathRollFor(rules);
  const actions = usePostbattleUnitActions({
    campaignId,
    battleId,
    battleState,
    rosters,
    userId: user?.id,
    rules,
    drafting,
    applyBattleResponse,
  });
  const finds = useFindItemSearch({ campaignId, drafting });
  const exit = usePostbattleExit({
    campaignId,
    battleId,
    battleState,
    currentParticipant,
    canManageBattles: Boolean(campaign?.permissions?.includes("manage_battles")),
    userId: user?.id,
    exploration: explore.exploration,
    drafting,
    applyBattleResponse,
  });

  const { draft } = drafting;
  const groups = useMemo(
    () => (draft ? buildRenderableGroups(draft, currentRoster) : []),
    [currentRoster, draft]
  );
  const upkeepRows = useMemo(() => buildUpkeepRows(draft, currentRoster), [currentRoster, draft]);
  const upkeepTotal = useMemo(() => getPostbattleUpkeepTotal(draft), [draft]);
  const victimName = useCallback(
    (kill: BattleEvent) => killVictimName(kill, battleState.participants, rosters),
    [battleState.participants, rosters]
  );
  // Each unit's kills that still count, by victim: the list is the number (BATL-NEW-06).
  const victimsByUnitKey = useMemo(
    () =>
      Object.fromEntries(
        groups
          .flatMap((group) => group.rows)
          .map((row) => [
            row.unitKey,
            liveKillEvents(battleState.events, row.unitKey, user?.id).map(victimName),
          ])
      ),
    [battleState.events, groups, user?.id, victimName]
  );
  const summary = useMemo(
    () =>
      buildFinalizeSummary({
        groups,
        draft,
        victimsByUnitKey,
        resourceAmount: explore.amount,
        resourceName: explore.resource?.name ?? null,
        upkeepRows,
        upkeepTotal,
      }),
    [
      draft,
      explore.amount,
      explore.resource?.name,
      groups,
      upkeepRows,
      upkeepTotal,
      victimsByUnitKey,
    ]
  );
  const baseStatsByUnitKey = useMemo(
    () =>
      Object.fromEntries(flattenRosterUnits(currentRoster).map((unit) => [unit.key, unit.stats])),
    [currentRoster]
  );
  const saveBattleNotes = useCallback(
    async (battleNotes: string) => {
      if (!currentParticipant) {
        return;
      }
      applyBattleResponse(
        await saveBattleParticipantConfig(campaignId, battleId, { battle_notes: battleNotes })
      );
    },
    [applyBattleResponse, battleId, campaignId, currentParticipant]
  );
  const unitInformation = currentParticipant?.unit_information_json;
  const statChangeRows = useMemo(
    () =>
      buildStatChangeRows({
        groups,
        draft,
        baseStatsByUnitKey,
        unitInformation: unitInformation ?? {},
      }),
    [baseStatsByUnitKey, draft, groups, unitInformation]
  );
  const rowTools: PostbattleRowTools = {
    draft,
    isFinalized: exit.isFinalized,
    actions,
    events: battleState.events,
    userId: user?.id,
    victimName,
  };

  return {
    battle,
    currentParticipant,
    currentRoster,
    rosterLoading: ownUserId !== undefined ? Boolean(battle.rosterLoading[ownUserId]) : false,
    rosterError: ownUserId !== undefined ? battle.rosterErrors[ownUserId] : "",
    resources,
    isResourcesLoading: warbandId !== null && sheetQuery.isPending,
    heroDeathRoll,
    drafting,
    explore,
    actions,
    finds,
    exit,
    groups,
    upkeepRows,
    upkeepTotal,
    summary,
    statChangeRows,
    rowTools,
    saveBattleNotes,
    canFinalize: Boolean(draft && explore.exploration && isPostbattleDraftValid(draft)),
  };
}
