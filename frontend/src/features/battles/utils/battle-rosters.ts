import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

/** True once every participant's roster has loaded or failed and none is still loading. */
export function allRostersSettled(
  participants: BattleParticipant[],
  rosters: Record<number, ParticipantRoster>,
  rosterLoading: Record<number, boolean>,
  rosterErrors: Record<number, string>
) {
  const userIds = participants.map((participant) => participant.user.id);
  return (
    userIds.every((userId) => Boolean(rosters[userId] || rosterErrors[userId])) &&
    !userIds.some((userId) => Boolean(rosterLoading[userId]))
  );
}
