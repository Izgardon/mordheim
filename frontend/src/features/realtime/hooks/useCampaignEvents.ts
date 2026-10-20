import { useQueryClient } from "@tanstack/react-query";

import { writeCampaignAnswer } from "@/features/campaigns/hooks/useCampaignQuery";
import { useCampaignUpdates } from "@/lib/realtime";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

/**
 * Campaign changes made by other members reach this one live (CAMP-NEW-07): `campaign.updated`
 * (a start, settings, a new join code, archive or restore) is written over the cached campaign,
 * keeping the reader's own role, permissions, capabilities and unread count.
 */
export function useCampaignEvents(campaignId: number | null) {
  const queryClient = useQueryClient();
  useCampaignUpdates(campaignId, (payload) => {
    if (campaignId) {
      writeCampaignAnswer(queryClient, campaignId, payload as unknown as CampaignSummary);
    }
  });
}
