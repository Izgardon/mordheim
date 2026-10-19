import { deadlineLabel, idleLabel } from "@/features/battles/utils/battle-timing";

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

/** "Postbattle · closes in 2 days · idle 3 days" (decision 2). */
export const battleStatusLine = (battle: CampaignActiveBattle["battle"]) =>
  [
    battleStatusLabel(battle.status),
    deadlineLabel(battle, { short: true }),
    idleLabel(battle.last_activity_at),
  ]
    .filter(Boolean)
    .join(" · ");

export const getCreatorLabel = (battle: CampaignActiveBattle) =>
  battle.participants.find(
    (participant) => participant.user.id === battle.battle.created_by_user_id
  )?.user.label ?? "Unknown";

export const getParticipantSummary = (battle: CampaignActiveBattle) =>
  battle.participants.map((participant) => participant.warband.name).join(", ");
