/**
 * Campaign chat as the app mounts it (RealtimeProvider above the campaign layout, fake socket and
 * server): the unread badge and what counts towards it, opening the window, and sending.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import {
  CHAT_CHANNEL,
  NAMELESS,
  OWNER,
  PLAYER,
  campaignApi,
  chatMessage,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "aldric@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const MESSAGES = `GET ${campaignApi("messages/")}`;
const SEND = `POST ${campaignApi("messages/")}`;

const chatButton = () => screen.getByRole("button", { name: "Campaign chat" });

/** A message arriving on the campaign's chat channel. */
const arrive = (message: ReturnType<typeof chatMessage>) =>
  act(() => fakeRealtime.emit(CHAT_CHANNEL, "chat.message", message));

/** Renders a campaign page (Skills) and waits for the chat subscription. */
async function openCampaignPage() {
  const view = renderCampaignRoute("/campaigns/1/skills");
  expect(await screen.findByText("Skills page")).toBeInTheDocument();
  await waitFor(() => expect(fakeRealtime.subscriberCount(CHAT_CHANNEL)).toBe(1));
  return view;
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  fakeApi.on(MESSAGES, [chatMessage(1, PLAYER, "Ready when you are")]);
});

describe("Campaign chat unread badge", () => {
  it("counts every message that arrives while the chat is closed, your own from another device included (IMP-78, pinned; flips in PR C)", async () => {
    await openCampaignPage();
    expect(chatButton()).toHaveTextContent("");

    await arrive(chatMessage(11, PLAYER, "Who has the rope?"));
    expect(chatButton()).toHaveTextContent("1");

    // Sent by you, from your phone.
    await arrive(chatMessage(12, OWNER, "I do"));
    expect(chatButton()).toHaveTextContent("2");
  });

  it("forgets the count on a reload, though nothing was read (IMP-78, pinned; flips in PR C)", async () => {
    const first = await openCampaignPage();
    await arrive(chatMessage(11, PLAYER, "Who has the rope?"));
    await arrive(chatMessage(12, PLAYER, "Anyone?"));
    expect(chatButton()).toHaveTextContent("2");
    first.unmount();
    fakeRealtime.reset();

    await openCampaignPage();

    expect(chatButton()).toHaveTextContent("");
    expect(fakeApi.countOf(MESSAGES)).toBe(0);
  });

  it("clears the badge on opening, reads the latest page once, and lists live messages without counting them", async () => {
    const user = setupUser();
    await openCampaignPage();
    await arrive(chatMessage(11, PLAYER, "Who has the rope?"));

    await user.click(chatButton());

    const dialog = screen.getByRole("dialog", { name: "Campaign Chat" });
    expect(await within(dialog).findByText("Ready when you are")).toBeInTheDocument();
    expect(fakeApi.countOf(MESSAGES)).toBe(1);
    await arrive(chatMessage(13, PLAYER, "Found it"));
    expect(await within(dialog).findByText("Found it")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(chatButton()).toHaveTextContent("");
  });
});

describe("Campaign chat window", () => {
  it("sends the trimmed draft; a refused send keeps it and says why, and Send posts it again", async () => {
    const user = setupUser();
    fakeApi.fail(SEND, new ApiError("Request failed (500)", 500, null));
    await openCampaignPage();
    await user.click(chatButton());
    const dialog = screen.getByRole("dialog", { name: "Campaign Chat" });
    await within(dialog).findByText("Ready when you are");
    const input = within(dialog).getByPlaceholderText("Send a message...");

    await user.type(input, "  Hold the bridge  ");
    await user.click(within(dialog).getByRole("button", { name: "Send message" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The server ran into a problem. Please try again."
    );
    expect(input).toHaveValue("  Hold the bridge  ");

    fakeApi.on(SEND, chatMessage(20, OWNER, "Hold the bridge"));
    await user.click(within(dialog).getByRole("button", { name: "Send message" }));

    expect(await within(dialog).findByText("Hold the bridge")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(
      fakeApi
        .requests()
        .filter((request) => request.method === "POST")
        .map((r) => r.body)
    ).toEqual([{ body: "Hold the bridge" }, { body: "Hold the bridge" }]);
  });

  it("has a message box with a placeholder and no label (CAMP-UX-07, pinned; flips in PR A)", async () => {
    const user = setupUser();
    await openCampaignPage();

    await user.click(chatButton());

    const dialog = screen.getByRole("dialog", { name: "Campaign Chat" });
    expect(within(dialog).getByRole("textbox")).toHaveAccessibleName("");
    expect(within(dialog).queryByRole("textbox", { name: /message/i })).not.toBeInTheDocument();
  });

  it("shows a nameless member's messages under the server's display name, never an email (SEC-13)", async () => {
    const user = setupUser();
    fakeApi.on(MESSAGES, [chatMessage(2, NAMELESS, "Hello all")]);
    await openCampaignPage();

    await user.click(chatButton());

    const dialog = screen.getByRole("dialog", { name: "Campaign Chat" });
    expect(await within(dialog).findByText("Hello all")).toBeInTheDocument();
    expect(within(dialog).getByText("Player 12")).toBeInTheDocument();
    expect(within(dialog).queryByText(/@example\.com/)).not.toBeInTheDocument();
  });
});
