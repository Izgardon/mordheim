import { deadlineLabel, idleDuration, idleLabel } from "@/features/battles/utils/battle-timing";

import type { CampaignActiveBattle } from "../../types/campaign-types";

/** How Settings > Active Battles names a battle's type, status and players. */

export const battleTypeLabel = (flowType: CampaignActiveBattle["battle"]["flow_type"]) =>
  flowType === "reported_result" ? "Result request" : "Battle";

const battleStatusLabel = (status: CampaignActiveBattle["battle"]["status"]) => {
  switch (status) {
    case "inviting":
      return "Request sent";
    case "reported_result_pending":
      return "Awaiting replies";
    case "prebattle":
      return "Prebattle";
    case "active":
      return "Active";
    case "postbattle":
      return "Postbattle";
    case "ended":
      return "Ended";
    case "canceled":
      return "Canceled";
    default:
      return status;
  }
};

export const participantStatusLabel = (
  status: CampaignActiveBattle["participants"][number]["status"]
) => {
  switch (status) {
    case "invited":
      return "Invited";
    case "accepted":
      return "Accepted";
    case "reported_result_pending":
      return "Pending";
    case "reported_result_approved":
      return "Approved";
    case "reported_result_declined":
      return "Declined";
    case "joined_prebattle":
      return "Joined prebattle";
    case "ready":
      return "Ready";
    case "canceled_prebattle":
      return "Canceled";
    case "declined":
      return "Declined";
    case "in_battle":
      return "In battle";
    case "finished_battle":
      return "Finished";
    case "confirmed_postbattle":
      return "Confirmed";
    default:
      return status;
  }
};

export const formatCreatedAt = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return "-";
  }
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/**
 * "Postbattle · closes in 2 days · idle 3 days" (decision 2): the idle time the server counted
 * (`idle_seconds`, CAMP-NEW-05) when it sent one, else from the battle's last write.
 */
export const battleStatusLine = (
  battle: CampaignActiveBattle["battle"],
  idleSeconds?: number | null
) => {
  const idleFromServer = idleDuration(idleSeconds);
  return [
    battleStatusLabel(battle.status),
    deadlineLabel(battle, { short: true }),
    idleFromServer ? `idle ${idleFromServer}` : idleLabel(battle.last_activity_at),
  ]
    .filter(Boolean)
    .join(" · ");
};

/**
 * The stuck battles among Active Battles (24 h idle, the server's call): how many, and the
 * longest idle among them (CAMP-NEW-05). Null when none is stuck.
 */
export function stuckBattlesSummary(battles: CampaignActiveBattle[]) {
  const stuck = battles.filter((entry) => entry.stuck);
  if (stuck.length === 0) {
    return null;
  }
  const longest = Math.max(...stuck.map((entry) => entry.idle_seconds ?? 0));
  const idle = idleDuration(longest) ?? "a day";
  return stuck.length === 1
    ? `1 battle idle for ${idle}`
    : `${stuck.length} battles idle, the longest for ${idle}`;
}

export const getCreatorLabel = (battle: CampaignActiveBattle) =>
  battle.participants.find(
    (participant) => participant.user.id === battle.battle.created_by_user_id
  )?.user.label ?? "Unknown";

export const getParticipantSummary = (battle: CampaignActiveBattle) =>
  battle.participants.map((participant) => participant.warband.name).join(", ");
