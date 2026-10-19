import type {
  BattleParticipant,
  BattleParticipantStatus,
  BattleStatus,
} from "@/features/battles/types/battle-types";
import { idleLabel } from "@/features/battles/utils/battle-timing";

/**
 * Where each player is in the battle, for "who's holding up the battle" (BATL-NEW-08):
 * - `waiting`: the battle is waiting for them (an unanswered invite, not ready, postbattle open);
 * - `done`: they've done their part for now (accepted, ready, in battle, finished, skipped);
 * - `left`: declined or left before the battle, so nobody waits for them.
 */
export type ParticipantProgress = {
  label: string;
  tone: "waiting" | "done" | "left";
};

const LEFT: Partial<Record<BattleParticipantStatus, string>> = {
  declined: "Declined",
  canceled_prebattle: "Left",
  reported_result_declined: "Declined",
};

export function participantProgress(
  participant: Pick<BattleParticipant, "status" | "skipped_postbattle">,
  battleStatus: BattleStatus
): ParticipantProgress {
  const left = LEFT[participant.status];
  if (left) {
    return { label: left, tone: "left" };
  }
  switch (participant.status) {
    case "invited":
      return { label: "Invited", tone: "waiting" };
    case "accepted":
      return battleStatus === "inviting"
        ? { label: "Accepted", tone: "done" }
        : { label: "Not ready", tone: "waiting" };
    case "joined_prebattle":
      return { label: "Not ready", tone: "waiting" };
    case "ready":
      return { label: "Ready", tone: "done" };
    case "in_battle":
      return { label: "In battle", tone: "done" };
    case "finished_battle":
      return battleStatus === "postbattle"
        ? { label: "In postbattle", tone: "waiting" }
        : { label: "Finished battle", tone: "done" };
    case "confirmed_postbattle":
      return participant.skipped_postbattle
        ? { label: "Skipped", tone: "done" }
        : { label: "Finished", tone: "done" };
    default:
      return { label: participant.status, tone: "done" };
  }
}

/** Each player still in the battle, with their progress and how long since they were last seen. */
export function battleProgress(
  participants: BattleParticipant[],
  battleStatus: BattleStatus,
  now = Date.now()
) {
  return participants
    .map((participant) => ({
      participant,
      progress: participantProgress(participant, battleStatus),
      idle: idleLabel(participant.last_seen_at, now),
    }))
    .filter((entry) => entry.progress.tone !== "left");
}
