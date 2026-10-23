import { useCallback, useMemo } from "react";

import {
  buildFinalizeSummary,
  type UpkeepRow,
} from "@/features/battles/components/postbattle/postbattle-summary";
import type { PostbattleRenderableGroup } from "@/features/battles/components/postbattle/postbattle-utils";
import { buildStatChangeRows } from "@/features/battles/components/postbattle/stat-changes";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import { flattenRosterUnits } from "@/features/battles/components/prebattle/prebattle-utils";
import type {
  BattleEvent,
  BattleParticipant,
  BattlePostbattleState,
  BattleState,
} from "@/features/battles/types/battle-types";
import { liveKillEvents } from "@/features/battles/utils/battle-events";
import { killVictimName } from "@/features/battles/utils/kill-victims";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";

/**
 * What postbattle sums up from the draft and the battle: who each kill took out (the kill lists,
 * BATL-NEW-06), the units with stat changes to keep (BATL-TWEAK-04) and every permanent change
 * finalising applies (BATL-NEW-10).
 */
export function usePostbattleSummary({
  battleState,
  rosters,
  currentParticipant,
  currentRoster,
  userId,
  draft,
  groups,
  resourceAmount,
  resourceName,
  upkeepRows,
  upkeepTotal,
  sheet,
  campaign,
  leftUnitKeys,
}: {
  battleState: BattleState;
  rosters: Record<number, ParticipantRoster>;
  currentParticipant: BattleParticipant | null;
  currentRoster: ParticipantRoster | undefined;
  userId: number | undefined;
  draft: BattlePostbattleState | null;
  groups: PostbattleRenderableGroup[];
  resourceAmount: number;
  resourceName: string | null;
  upkeepRows: UpkeepRow[];
  upkeepTotal: number;
  sheet: WarbandSheet | undefined;
  campaign: CampaignSummary | null | undefined;
  /** Units that have left the warband since the battle began: their results are left out. */
  leftUnitKeys?: string[];
}) {
  const { participants, events } = battleState;
  const victimName = useCallback(
    (kill: BattleEvent) => killVictimName(kill, participants, rosters),
    [participants, rosters]
  );
  // Each unit's kills that still count, by victim: the list is the number (BATL-NEW-06).
  const victimsByUnitKey = useMemo(
    () =>
      Object.fromEntries(
        groups
          .flatMap((group) => group.rows)
          .map((row) => [row.unitKey, liveKillEvents(events, row.unitKey, userId).map(victimName)])
      ),
    [events, groups, userId, victimName]
  );
  const baseStatsByUnitKey = useMemo(
    () =>
      Object.fromEntries(flattenRosterUnits(currentRoster).map((unit) => [unit.key, unit.stats])),
    [currentRoster]
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
  const summary = useMemo(
    () =>
      buildFinalizeSummary({
        groups,
        draft,
        victimsByUnitKey,
        statChangeRows,
        events,
        userId,
        roster: currentRoster,
        sheet,
        campaign: campaign ?? null,
        suggestion: battleState.suggested_postbattle,
        resourceAmount,
        resourceName,
        upkeepRows,
        upkeepTotal,
        leftUnitKeys,
      }),
    [
      leftUnitKeys,
      battleState.suggested_postbattle,
      campaign,
      currentRoster,
      draft,
      events,
      groups,
      resourceAmount,
      resourceName,
      sheet,
      statChangeRows,
      upkeepRows,
      upkeepTotal,
      userId,
      victimsByUnitKey,
    ]
  );
  return { victimName, statChangeRows, summary };
}
