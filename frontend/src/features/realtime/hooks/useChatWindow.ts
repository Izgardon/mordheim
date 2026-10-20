import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { removeCampaignMessage, sendCampaignMessage } from "@/features/campaigns/api/campaigns-api";
import { useCampaignChatRemovals } from "@/lib/realtime";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { useCampaignChat } from "./useCampaignChat";
import {
  appendChatMessage,
  chatHistoryQuery,
  chatMessagesFromPages,
  markChatMessageRemoved,
} from "../utils/chat-cache";

/**
 * The open chat window (BUG-20): the history as an infinite query read while the window is open
 * (each opening reads the latest page afresh, `resetHistory`), live messages and your own sends
 * written into it, older pages on scrolling up, and the failures of each. A reconnect reads the
 * open history again through RealtimeProvider's campaign catch-up.
 */
export function useChatWindow(campaignId: number, isOpen: boolean) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const { unread, markRead, addMessageListener } = useCampaignChat();
  const history = useInfiniteQuery({
    ...chatHistoryQuery(campaignId),
    enabled: isOpen,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const messages = useMemo(() => chatMessagesFromPages(history.data?.pages ?? []), [history.data]);

  const listRef = useRef<HTMLDivElement>(null);
  const scrolledToLatest = useRef(false);
  const heightBeforeOlder = useRef<number | null>(null);

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

  // The first page lands at the bottom; an older page keeps the message you were reading in place.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (heightBeforeOlder.current !== null && list) {
      const previousHeight = heightBeforeOlder.current;
      heightBeforeOlder.current = null;
      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight - previousHeight;
      });
    } else if (!scrolledToLatest.current && history.data) {
      scrolledToLatest.current = true;
      scrollToBottom();
    }
  }, [history.data, scrollToBottom]);

  /** Called as the window opens: drops the history read last time, so the latest page is read. */
  const resetHistory = useCallback(() => {
    scrolledToLatest.current = false;
    heightBeforeOlder.current = null;
    void queryClient.resetQueries({ queryKey: queryKeys.campaign.chat(campaignId), exact: true });
  }, [campaignId, queryClient]);

  useEffect(() => {
    if (!isOpen) return;
    setSendError("");
    markRead();
  }, [isOpen, markRead]);

  // While open, live messages land in the list; RealtimeProvider counts them as unread otherwise.
  useEffect(() => {
    if (!isOpen) return;
    return addMessageListener((message) => {
      appendChatMessage(queryClient, campaignId, message);
      scrollToBottom(true);
    });
  }, [addMessageListener, campaignId, isOpen, queryClient, scrollToBottom]);

  // A removal made elsewhere shows at once while the window is open (CAMP-NEW-06).
  useCampaignChatRemovals(isOpen ? campaignId : null, (removal) =>
    markChatMessageRemoved(queryClient, campaignId, removal)
  );

  /** An owner or admin removes a message; it stays in place as "removed by admin". */
  const removeMessage = async (messageId: number) => {
    await removeCampaignMessage(campaignId, messageId);
    markChatMessageRemoved(queryClient, campaignId, {
      id: messageId,
      removed_at: new Date().toISOString(),
      removed_by: "admin",
    });
  };

  const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError, refetch } = history;
  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list || isFetching || !hasNextPage || list.scrollTop > 0) return;
    heightBeforeOlder.current = list.scrollHeight;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetching]);

  /** Retries whichever page failed: the latest, or the older page being scrolled to. */
  const retryLoad = useCallback(() => {
    void (isFetchNextPageError ? fetchNextPage() : refetch());
  }, [fetchNextPage, isFetchNextPageError, refetch]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    setSendError("");
    try {
      appendChatMessage(queryClient, campaignId, await sendCampaignMessage(campaignId, body));
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
    isLoading: history.isLoading || history.isFetchingNextPage,
    loadError: history.error ? getErrorMessage(history.error, "Couldn't load the chat.") : "",
    retryLoad,
    resetHistory,
    listRef,
    handleScroll,
    draft,
    updateDraft,
    isSending,
    sendError,
    handleSend,
    removeMessage,
  };
}
