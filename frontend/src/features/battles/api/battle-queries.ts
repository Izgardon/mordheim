import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { getBattleRosters, getBattleState } from "@/features/battles/api/battles-api";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import { getBattleStateLastEventId, mergeBattleState } from "@/features/battles/state/battle-cache";
import type {
  BattleRosterMap,
  BattleState,
  BattleStateView,
} from "@/features/battles/types/battle-types";
import { queryKeys } from "@/lib/query-keys";

/**
 * A battle's server state for the battle pages (IMP-51, PLAN 0.5). `BattleLayout` owns both
 * queries, so moving between prebattle, active and postbattle reads nothing again; writes and
 * socket messages update the cached state in place.
 *
 * Every visit reads afresh (`gcTime: 0`), as each page did before; nothing refetches on focus,
 * reconnect or a timer, because the battle channel keeps the state current.
 */
const BATTLE_QUERY_DEFAULTS = {
  staleTime: Infinity,
  gcTime: 0,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retry: false,
  // Pages compare participants and events by reference to rebuild what they derive from them.
  structuralSharing: false,
} as const;

/**
 * The battle's state. A read asks only for the events after the cached ones and merges its answer
 * into whatever the cache holds when it lands.
 */
export function battleStateQuery(
  queryClient: QueryClient,
  campaignId: number,
  battleId: number,
  readView: () => BattleStateView
) {
  const queryKey = queryKeys.campaign.battleState(campaignId, battleId);
  return queryOptions({
    queryKey,
    queryFn: async () => {
      const sinceEventId = getBattleStateLastEventId(
        queryClient.getQueryData<BattleState>(queryKey) ?? null
      );
      const next = await getBattleState(campaignId, battleId, { sinceEventId, view: readView() });
      return mergeBattleState(queryClient.getQueryData<BattleState>(queryKey) ?? null, next);
    },
    ...BATTLE_QUERY_DEFAULTS,
  });
}

/** `GET rosters/` keyed by participant user id, in the pages' unit shape. */
export function toParticipantRosters(
  rosterMap: BattleRosterMap
): Record<number, ParticipantRoster> {
  const normalized: Record<number, ParticipantRoster> = {};
  for (const [userIdRaw, roster] of Object.entries(rosterMap)) {
    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId)) {
      continue;
    }
    normalized[userId] = {
      heroes: roster.heroes.map((hero) => ({ ...hero })),
      hirelings: roster.hirelings.map((hireling) => ({ ...hireling })),
      henchmenGroups: roster.henchmenGroups.map((group) => ({
        ...group,
        members: group.members.map((member) => ({ ...member })),
      })),
    };
  }
  return normalized;
}

/** Every participant's roster, read once per visit (from the start snapshot once started). */
export function battleRostersQuery(campaignId: number, battleId: number) {
  return queryOptions({
    queryKey: queryKeys.campaign.battleRosters(campaignId, battleId),
    queryFn: async () => toParticipantRosters(await getBattleRosters(campaignId, battleId)),
    ...BATTLE_QUERY_DEFAULTS,
  });
}
