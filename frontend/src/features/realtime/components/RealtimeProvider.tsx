import { useEffect } from "react";
import type { PropsWithChildren } from "react";
import { useMatch } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { isCampaignId } from "@/features/campaigns/hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";
import { disconnectRealtime, useRealtimeReconnect } from "@/lib/realtime";
import { CampaignChatContext, useCampaignChatState } from "../hooks/useCampaignChat";
import { useCampaignEvents } from "../hooks/useCampaignEvents";
import { useNotificationSubscription } from "../hooks/useNotificationSubscription";

function useActiveCampaignId() {
  const match = useMatch("/campaigns/:id/*");
  const campaignId = Number(match?.params.id);
  return isCampaignId(campaignId) ? campaignId : null;
}

/**
 * Realtime for every signed-in screen, mounted once above them (PERF-18): the user's
 * notifications, the current campaign's chat and live changes (CAMP-NEW-07), and catch-up after
 * the connection drops.
 * Navigating between campaign pages, or to and from the campaigns list, keeps the
 * subscriptions instead of rebuilding them.
 */
export function RealtimeProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const campaignId = useActiveCampaignId();
  const chat = useCampaignChatState(campaignId);
  useCampaignEvents(campaignId);
  useNotificationSubscription();

  // Events published while the socket was down are gone; refetch what's on screen (BUG-19).
  useRealtimeReconnect(() => {
    if (campaignId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.all(campaignId) });
    }
  });

  // Nothing outside the signed-in screens listens; close the socket when they unmount.
  useEffect(() => () => disconnectRealtime(), []);

  return <CampaignChatContext.Provider value={chat}>{children}</CampaignChatContext.Provider>;
}
