import { useCallback, useEffect, useRef, useState } from "react";

import { listCampaignMessages, sendCampaignMessage } from "@/features/campaigns/api/campaigns-api";
import type { CampaignMessage } from "@/features/campaigns/types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { useRealtimeReconnect } from "@/lib/realtime";
import { useCampaignChat } from "./useCampaignChat";

const PAGE_SIZE = 50;

/** The open chat window: history pages, live messages, sending, and their failures (BUG-20). */
export function useChatWindow(campaignId: number, isOpen: boolean) {
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const { unread, markRead, addMessageListener } = useCampaignChat();

  const listRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const messagesRef = useRef<CampaignMessage[]>([]);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = useCallback((onlyIfNearBottom = false) => {
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
      if (!onlyIfNearBottom || isNearBottom) {
        list.scrollTop = list.scrollHeight;
      }
    });
  }, []);

  const appendMessage = useCallback((message: CampaignMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }, []);

  const loadMessages = useCallback(
    async (before?: number) => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setIsLoading(true);
      try {
        const data = await listCampaignMessages(campaignId, before);
        // API returns newest-first; reverse for chronological display
        const reversed = [...data].reverse();
        hasMoreRef.current = data.length === PAGE_SIZE;
        setLoadError("");
        if (before) {
          const list = listRef.current;
          const prevHeight = list?.scrollHeight ?? 0;
          setMessages((prev) => [...reversed, ...prev]);
          requestAnimationFrame(() => {
            if (list) {
              list.scrollTop = list.scrollHeight - prevHeight;
            }
          });
        } else {
          setMessages(reversed);
          scrollToBottom();
        }
      } catch (error) {
        // Not "No messages yet": the history is unknown, so say so and offer a retry.
        setLoadError(getErrorMessage(error, "Couldn't load the chat."));
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [campaignId, scrollToBottom]
  );

  // While open, live messages land in the list; RealtimeProvider counts them as unread otherwise.
  useEffect(() => {
    if (!isOpen) return;
    return addMessageListener((message) => {
      appendMessage(message);
      scrollToBottom(true);
    });
  }, [addMessageListener, appendMessage, isOpen, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;
    setMessages([]);
    messagesRef.current = [];
    hasMoreRef.current = true;
    setLoadError("");
    setSendError("");
    markRead();
    void loadMessages();
  }, [isOpen, loadMessages, markRead]);

  // Messages sent while the connection was down never arrive live: reload the latest page.
  useRealtimeReconnect(() => {
    if (isOpenRef.current) {
      void loadMessages();
    }
  });

  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list || isLoadingRef.current || !hasMoreRef.current || list.scrollTop > 0) return;
    const oldest = messagesRef.current[0];
    if (oldest) {
      void loadMessages(oldest.id);
    }
  }, [loadMessages]);

  /** Retries whichever page failed: the latest, or the older page being scrolled to. */
  const retryLoad = useCallback(() => {
    void loadMessages(messagesRef.current[0]?.id);
  }, [loadMessages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    setSendError("");
    try {
      appendMessage(await sendCampaignMessage(campaignId, body));
      // The draft stays until the server has the message, so a failure never loses it.
      setDraft((current) => (current.trim() === body ? "" : current));
      scrollToBottom();
    } catch (error) {
      setSendError(getErrorMessage(error, "Couldn't send your message. Please try again."));
    } finally {
      setIsSending(false);
    }
  };

  const updateDraft = (value: string) => {
    setDraft(value);
    setSendError("");
  };

  return {
    unread,
    messages,
    isLoading,
    loadError,
    retryLoad,
    listRef,
    handleScroll,
    draft,
    updateDraft,
    isSending,
    sendError,
    handleSend,
  };
}
