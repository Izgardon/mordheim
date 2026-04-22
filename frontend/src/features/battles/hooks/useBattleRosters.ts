import { useEffect, useMemo, useState } from "react";

import { getBattleRosters } from "@/features/battles/api/battles-api";
import type { BattleParticipant, BattleRosterMap } from "@/features/battles/types/battle-types";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";

function toParticipantRosters(rosterMap: BattleRosterMap): Record<number, ParticipantRoster> {
  const normalized: Record<number, ParticipantRoster> = {};
  for (const [userIdRaw, roster] of Object.entries(rosterMap)) {
    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId)) {
      continue;
    }
    normalized[userId] = {
      heroes: roster.heroes.map((hero) => ({
        ...hero,
        id: hero.id,
      })),
      hiredSwords: roster.hiredSwords.map((hiredSword) => ({
        ...hiredSword,
        id: hiredSword.id,
      })),
      henchmenGroups: roster.henchmenGroups.map((group) => ({
        ...group,
        members: group.members.map((member) => ({
          ...member,
          id: member.id,
        })),
      })),
    };
  }
  return normalized;
}

export function useBattleRosters(
  campaignId: number,
  battleId: number,
  participants?: BattleParticipant[]
) {
  const [rosters, setRosters] = useState<Record<number, ParticipantRoster>>({});
  const [rosterLoading, setRosterLoading] = useState<Record<number, boolean>>({});
  const [rosterErrors, setRosterErrors] = useState<Record<number, string>>({});

  const participantUserIds = useMemo(
    () => (participants ?? []).map((participant) => participant.user.id),
    [participants]
  );
  const participantUserIdsKey = participantUserIds.join(",");

  useEffect(() => {
    if (Number.isNaN(campaignId) || Number.isNaN(battleId)) {
      setRosters({});
      setRosterLoading({});
      setRosterErrors({});
      return;
    }
    if (!participants?.length || participantUserIds.length === 0) {
      setRosters({});
      setRosterLoading({});
      setRosterErrors({});
      return;
    }

    let active = true;
    setRosters({});
    setRosterLoading(
      Object.fromEntries(participantUserIds.map((participantUserId) => [participantUserId, true]))
    );
    setRosterErrors(
      Object.fromEntries(participantUserIds.map((participantUserId) => [participantUserId, ""]))
    );

    getBattleRosters(campaignId, battleId)
      .then((payload) => {
        if (!active) {
          return;
        }
        const nextRosters = toParticipantRosters(payload);
        const nextLoading: Record<number, boolean> = {};
        const nextErrors: Record<number, string> = {};
        for (const userId of Object.keys(nextRosters).map(Number)) {
          nextLoading[userId] = false;
          nextErrors[userId] = "";
        }
        setRosters(nextRosters);
        setRosterLoading(nextLoading);
        setRosterErrors(nextErrors);
      })
      .catch((errorResponse) => {
        if (!active) {
          return;
        }
        const message =
          errorResponse instanceof Error
            ? errorResponse.message || "Unable to load roster"
            : "Unable to load roster";
        setRosters({});
        setRosterLoading(
          Object.fromEntries(participantUserIds.map((participantUserId) => [participantUserId, false]))
        );
        setRosterErrors(
          Object.fromEntries(participantUserIds.map((participantUserId) => [participantUserId, message]))
        );
      });

    return () => {
      active = false;
    };
  }, [battleId, campaignId, participantUserIdsKey, participants?.length]);

  return useMemo(
    () => ({
      rosters,
      rosterLoading,
      rosterErrors,
    }),
    [rosterErrors, rosterLoading, rosters]
  );
}
