import type {
  CampaignBattleHistoryEntry,
  CampaignChronicleEntry,
  CampaignSummary,
} from "../../types/campaign-types";
import type { Standing } from "./overview-data";

/**
 * Export the campaign (the overview's ⋯ menu): what the overview shows (the standings, every
 * battle with its moments, and the chronicle read so far) as a JSON file the browser saves. There
 * is no server export yet; this is the overview's own data.
 */
export function exportCampaign(
  campaign: CampaignSummary,
  standings: Standing[],
  battles: CampaignBattleHistoryEntry[],
  chronicle: CampaignChronicleEntry[]
) {
  const data = {
    campaign: campaign.name,
    exported_at: new Date().toISOString(),
    standings: standings.map(({ rank, warband, player, faction, rating, record }) => ({
      rank,
      warband,
      player,
      faction,
      rating,
      won_drawn_lost: record,
    })),
    battles,
    chronicle,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${campaign.name.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "campaign"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
