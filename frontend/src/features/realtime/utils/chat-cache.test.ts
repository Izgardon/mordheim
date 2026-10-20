import { describe, expect, it } from "vitest";

import { createTestQueryClient } from "@/test/query-test-utils";
import { queryKeys } from "@/lib/query-keys";
import {
  appendChatMessage,
  chatHistoryQuery,
  chatMessagesFromPages,
  markChatMessageRemoved,
  type ChatHistory,
  type ChatPage,
} from "./chat-cache";

import type { CampaignMessage } from "@/features/campaigns/types/campaign-types";

const message = (id: number): CampaignMessage => ({
  id,
  campaign_id: 1,
  user_id: 2,
  username: "Mira",
  body: `Message ${id}`,
  created_at: "2026-10-18T20:00:00Z",
});

const page = (ids: number[], hasMore = false): ChatPage => ({
  messages: ids.map(message),
  hasMore,
});

const ids = (messages: CampaignMessage[]) => messages.map((entry) => entry.id);

describe("chatMessagesFromPages", () => {
  it("lists the pages oldest first, each page newest-first as the server sends it", () => {
    expect(ids(chatMessagesFromPages([page([6, 5, 4], true), page([3, 2, 1])]))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("is empty with no pages", () => {
    expect(chatMessagesFromPages([])).toEqual([]);
  });
});

describe("chatHistoryQuery", () => {
  const { getNextPageParam } = chatHistoryQuery(1);

  it("asks for messages before the oldest shown while the server has more", () => {
    expect(getNextPageParam(page([60, 59, 51], true))).toBe(51);
  });

  it("stops at the oldest page", () => {
    expect(getNextPageParam(page([3, 2, 1]))).toBeUndefined();
  });
});

describe("appendChatMessage", () => {
  const key = queryKeys.campaign.chat(1);
  const cached = (queryClient: ReturnType<typeof createTestQueryClient>) =>
    ids(chatMessagesFromPages(queryClient.getQueryData<ChatHistory>(key)!.pages));

  it("adds a message after the newest, keeping whether older pages remain", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData<ChatHistory>(key, {
      pages: [page([5, 4], true), page([3])],
      pageParams: [undefined, 4],
    });

    appendChatMessage(queryClient, 1, message(6));

    expect(cached(queryClient)).toEqual([3, 4, 5, 6]);
    expect(queryClient.getQueryData<ChatHistory>(key)!.pages[0].hasMore).toBe(true);
  });

  it("adds a message once, though it arrives live and as the send's answer", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData<ChatHistory>(key, { pages: [page([2, 1])], pageParams: [undefined] });

    appendChatMessage(queryClient, 1, message(3));
    appendChatMessage(queryClient, 1, message(3));

    expect(cached(queryClient)).toEqual([1, 2, 3]);
  });

  it("does nothing while no window holds the history", () => {
    const queryClient = createTestQueryClient();

    appendChatMessage(queryClient, 1, message(3));

    expect(queryClient.getQueryData(key)).toBeUndefined();
  });
});

describe("markChatMessageRemoved", () => {
  it("empties the message where it is and marks who removed it (CAMP-NEW-06)", () => {
    const queryClient = createTestQueryClient();
    const key = queryKeys.campaign.chat(1);
    queryClient.setQueryData<ChatHistory>(key, { pages: [page([2, 1])], pageParams: [undefined] });

    markChatMessageRemoved(queryClient, 1, {
      id: 1,
      removed_at: "2026-10-19T10:00:00Z",
      removed_by: "admin",
    });

    const [newest, removed] = queryClient.getQueryData<ChatHistory>(key)!.pages[0].messages;
    expect(newest.body).toBe("Message 2");
    expect(removed).toMatchObject({ id: 1, body: "", removed_by: "admin" });
  });
});
