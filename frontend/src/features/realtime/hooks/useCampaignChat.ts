import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { useCampaignChatMessages, type ChatMessage } from "@/lib/realtime";

type ChatListener = (message: ChatMessage) => void;

export type CampaignChatValue = {
  campaignId: number | null;
  /** Messages that arrived while no chat window was open. */
  unread: number;
  markRead: () => void;
  /** An open chat window receives live messages instead of counting them as unread. */
  addMessageListener: (listener: ChatListener) => () => void;
};

export const CampaignChatContext = createContext<CampaignChatValue | null>(null);

/**
 * The campaign chat subscription, owned by RealtimeProvider so it outlives the chat button
 * (which unmounts when the mobile top bar swaps, the layout flips or a battle page opens).
 */
export function useCampaignChatState(campaignId: number | null): CampaignChatValue {
  const listenersRef = useRef(new Set<ChatListener>());
  const [unreadState, setUnreadState] = useState({ campaignId, count: 0 });
  if (unreadState.campaignId !== campaignId) {
    setUnreadState({ campaignId, count: 0 });
  }

  useCampaignChatMessages(campaignId, (message) => {
    if (listenersRef.current.size > 0) {
      listenersRef.current.forEach((listener) => listener(message));
      return;
    }
    setUnreadState((state) => ({ ...state, count: state.count + 1 }));
  });

  const markRead = useCallback(() => {
    setUnreadState((state) => (state.count === 0 ? state : { ...state, count: 0 }));
  }, []);

  const addMessageListener = useCallback((listener: ChatListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const unread = unreadState.campaignId === campaignId ? unreadState.count : 0;
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
