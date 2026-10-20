import type { InfiniteData, QueryClient } from "@tanstack/react-query";

// api
import { listCampaignMessages } from "@/features/campaigns/api/campaigns-api";

// other
import { queryKeys } from "@/lib/query-keys";

// types
import type { CampaignMessage } from "@/features/campaigns/types/campaign-types";

/** The server's page size for `messages/`. */
export const CHAT_PAGE_SIZE = 50;

/** One page of history, newest first, and whether the server has older messages. */
export type ChatPage = { messages: CampaignMessage[]; hasMore: boolean };
export type ChatHistory = InfiniteData<ChatPage, number | undefined>;

/**
 * The chat history as an infinite query (`["campaign", id, "chat"]`): the latest page first,
 * then older pages `before` the oldest message shown. Read only while the window is open.
 */
export const chatHistoryQuery = (campaignId: number) => ({
  queryKey: queryKeys.campaign.chat(campaignId),
  queryFn: async ({ pageParam }: { pageParam: number | undefined }): Promise<ChatPage> => {
    const messages = await listCampaignMessages(campaignId, pageParam);
    return { messages, hasMore: messages.length === CHAT_PAGE_SIZE };
  },
  initialPageParam: undefined as number | undefined,
  getNextPageParam: (lastPage: ChatPage) =>
    lastPage.hasMore ? lastPage.messages[lastPage.messages.length - 1]?.id : undefined,
});

/** The cached pages as one chronological list (each page, and the pages, newest first). */
export function chatMessagesFromPages(pages: ChatPage[]): CampaignMessage[] {
  return [...pages].reverse().flatMap((page) => [...page.messages].reverse());
}

/**
 * Puts a message (sent, or arrived live) at the end of the cached history, once. Nothing happens
 * while no window holds the history: it is read afresh when one opens.
 */
export function appendChatMessage(
  queryClient: QueryClient,
  campaignId: number,
  message: CampaignMessage
) {
  const key = queryKeys.campaign.chat(campaignId);
  queryClient.setQueryData<ChatHistory>(key, (history: ChatHistory | undefined) => {
    const isListed = history?.pages.some((page) =>
      page.messages.some((entry) => entry.id === message.id)
    );
    if (!history || isListed) {
      return history;
    }
    const [newest, ...older] = history.pages;
    const latest = newest ?? { messages: [], hasMore: false };
    return {
      ...history,
      pages: [{ ...latest, messages: [message, ...latest.messages] }, ...older],
    };
  });
}
