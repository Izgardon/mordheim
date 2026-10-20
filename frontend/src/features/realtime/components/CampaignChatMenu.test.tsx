import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listCampaignMessages, sendCampaignMessage } from "@/features/campaigns/api/campaigns-api";
import { ApiError } from "@/lib/api-client";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { CampaignChatContext, type CampaignChatValue } from "../hooks/useCampaignChat";
import CampaignChatMenu from "./CampaignChatMenu";

vi.mock("@/features/campaigns/api/campaigns-api", () => ({
  listCampaignMessages: vi.fn(),
  sendCampaignMessage: vi.fn(),
}));
vi.mock("@/stores/app-store", () => ({ useAppStore: () => ({ user: { id: 1 } }) }));
vi.mock("@/lib/realtime/client", () => ({
  subscribe: vi.fn(() => () => undefined),
  onConnectionRestored: vi.fn(() => () => undefined),
}));

const chat: CampaignChatValue = {
  campaignId: 7,
  unread: 0,
  markRead: () => undefined,
  addMessageListener: () => () => undefined,
};

const message = (id: number, body: string) => ({
  id,
  campaign_id: 7,
  user_id: 2,
  username: "Mira",
  body,
  created_at: "2026-10-17T10:00:00Z",
});

const openChat = () => {
  renderWithQueryClient(
    <CampaignChatContext.Provider value={chat}>
      <CampaignChatMenu campaignId={7} />
    </CampaignChatContext.Provider>
  );
  fireEvent.click(screen.getByRole("button", { name: "Campaign chat" }));
};

const sendDraft = (text: string) => {
  fireEvent.change(screen.getByPlaceholderText("Send a message..."), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
};

describe("CampaignChatMenu", () => {
  beforeEach(() => {
    vi.mocked(listCampaignMessages).mockReset();
    vi.mocked(sendCampaignMessage).mockReset();
  });

  it("shows a failed history load as an error with Retry, not as an empty chat", async () => {
    vi.mocked(listCampaignMessages).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    openChat();

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
    expect(screen.queryByText("No messages yet. Say something!")).not.toBeInTheDocument();

    vi.mocked(listCampaignMessages).mockResolvedValueOnce([message(1, "Ready when you are")]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Ready when you are")).toBeInTheDocument();
  });

  it("keeps the typed message and shows the error when sending fails", async () => {
    vi.mocked(listCampaignMessages).mockResolvedValue([]);
    vi.mocked(sendCampaignMessage).mockRejectedValueOnce(
      new ApiError("throttled", 429, {
        detail: "Request was throttled. Expected available in 5 seconds.",
      })
    );
    openChat();
    await screen.findByText("No messages yet. Say something!");

    sendDraft("Charge the left flank");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many attempts. Try again in 5 seconds."
    );
    expect(screen.getByPlaceholderText("Send a message...")).toHaveValue("Charge the left flank");
  });

  it("clears the input once the message is sent", async () => {
    vi.mocked(listCampaignMessages).mockResolvedValue([]);
    vi.mocked(sendCampaignMessage).mockResolvedValueOnce(message(5, "Hold the bridge"));
    openChat();
    await screen.findByText("No messages yet. Say something!");

    sendDraft("Hold the bridge");

    expect(await screen.findByText("Hold the bridge")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Send a message...")).toHaveValue("");
  });
});
