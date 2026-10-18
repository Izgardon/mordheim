import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { battleRostersQuery } from "@/features/battles/api/battle-queries";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleParticipant } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";

const byUserId = <T>(userIds: number[], value: T) =>
  Object.fromEntries(userIds.map((userId) => [userId, value])) as Record<number, T>;

/**
 * Every participant's roster (`['campaign', cid, 'battle', bid, 'rosters']`), read once the
 * participants are known and again only when they change; a phase change reads nothing (PERF-38).
 * Loading and errors are reported per participant user id, as the pages show them.
 */
export function useBattleRosters(
  campaignId: number,
  battleId: number,
  participants?: BattleParticipant[]
) {
  const participantUserIds = useMemo(
    () => (participants ?? []).map((participant) => participant.user.id),
    [participants]
  );
  const participantUserIdsKey = participantUserIds.join(",");
  const enabled =
    Number.isFinite(campaignId) && Number.isFinite(battleId) && participantUserIds.length > 0;

  const query = useQuery({ ...battleRostersQuery(campaignId, battleId), enabled });
  const { refetch } = query;

  // A different set of participants (someone joined or left) reads the rosters again.
  const fetchedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (fetchedForRef.current !== null && fetchedForRef.current !== participantUserIdsKey) {
      void refetch();
    }
    fetchedForRef.current = participantUserIdsKey;
  }, [enabled, participantUserIdsKey, refetch]);

  const { data, error, isPending } = query;
  return useMemo(() => {
    const userIds = participantUserIdsKey ? participantUserIdsKey.split(",").map(Number) : [];
    if (!enabled) {
      return { rosters: {}, rosterLoading: {}, rosterErrors: {} };
    }
    if (data) {
      const loadedIds = Object.keys(data).map(Number);
      return {
        rosters: data,
        rosterLoading: byUserId(loadedIds, false),
        rosterErrors: byUserId(loadedIds, ""),
      };
    }
    if (isPending) {
      return {
        rosters: {},
        rosterLoading: byUserId(userIds, true),
        rosterErrors: byUserId(userIds, ""),
      };
    }
    const message = getErrorMessage(error, "Unable to load roster");
    return {
      rosters: {},
      rosterLoading: byUserId(userIds, false),
      rosterErrors: byUserId(userIds, message),
    };
  }, [data, enabled, error, isPending, participantUserIdsKey]) as {
    rosters: Record<number, ParticipantRoster>;
    rosterLoading: Record<number, boolean>;
    rosterErrors: Record<number, string>;
  };
}
