import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { markCampaignChatRead } from "@/features/campaigns/api/campaigns-api";
import { useCampaignQuery } from "@/features/campaigns/hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";
import { useCampaignChatMessages, type ChatMessage } from "@/lib/realtime";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

type ChatListener = (message: ChatMessage) => void;

export type CampaignChatValue = {
  campaignId: number | null;
  /** Messages from others after your read mark: the campaign's count plus those since. */
  unread: number;
  /** Moves your read mark: to `lastReadId`, or to the newest message without one. */
  markRead: (lastReadId?: number) => void;
  /** An open chat window receives live messages instead of counting them as unread. */
  addMessageListener: (listener: ChatListener) => () => void;
};

export const CampaignChatContext = createContext<CampaignChatValue | null>(null);

/**
 * The campaign chat subscription and its unread badge (CAMP-TWEAK-09), owned by RealtimeProvider
 * so it outlives the chat button. The badge is the campaign's `chat_unread` (the server's count
 * after your read mark, across devices and reloads) plus messages from others that arrived since
 * the campaign was read; your own never count.
 */
export function useCampaignChatState(campaignId: number | null): CampaignChatValue {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const listenersRef = useRef(new Set<ChatListener>());
  const campaignQuery = useCampaignQuery(campaignId ?? Number.NaN, { read: false });
  const serverUnread = campaignQuery.data?.chat_unread ?? 0;
  const readAt = campaignQuery.dataUpdatedAt;
  // Live arrivals count on top of the campaign as it was read at `readAt`; a newer read has them.
  const [live, setLive] = useState({ campaignId, readAt, count: 0 });

  useCampaignChatMessages(campaignId, (message) => {
    if (listenersRef.current.size > 0) {
      listenersRef.current.forEach((listener) => listener(message));
      return;
    }
    if (message.user_id !== null && message.user_id === userId) {
      return;
    }
    setLive((state) =>
      state.campaignId === campaignId && state.readAt === readAt
        ? { ...state, count: state.count + 1 }
        : { campaignId, readAt, count: 1 }
    );
  });

  const markRead = useCallback(
    (lastReadId?: number) => {
      if (!campaignId) {
        return;
      }
      const key = queryKeys.campaign.detail(campaignId);
      const setUnread = (chat_unread: number) =>
        queryClient.setQueryData<CampaignSummary>(key, (campaign: CampaignSummary | undefined) =>
          campaign ? { ...campaign, chat_unread } : campaign
        );
      setLive({ campaignId, readAt: -1, count: 0 });
      setUnread(0);
      markCampaignChatRead(campaignId, lastReadId)
        .then((answer) => setUnread(answer.chat_unread))
        .catch(() => undefined);
    },
    [campaignId, queryClient]
  );

  const addMessageListener = useCallback((listener: ChatListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const liveCount = live.campaignId === campaignId && live.readAt === readAt ? live.count : 0;
  const unread = campaignId ? serverUnread + liveCount : 0;
  return useMemo(
    () => ({ campaignId, unread, markRead, addMessageListener }),
    [addMessageListener, campaignId, markRead, unread]
  );
}

export function useCampaignChat() {
  const context = useContext(CampaignChatContext);
  if (!context) {
    throw new Error("useCampaignChat must be used within RealtimeProvider");
  }
  return context;
}
