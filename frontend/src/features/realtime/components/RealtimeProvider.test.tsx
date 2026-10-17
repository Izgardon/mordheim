import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { disconnectRealtime, onConnectionRestored, subscribe } from "@/lib/realtime/client";
import { AppStoreProvider } from "@/stores/app-store";
import { renderWithQueryClient } from "@/test/query-test-utils";
import CampaignChatMenu from "./CampaignChatMenu";
import { RealtimeProvider } from "./RealtimeProvider";

const { auth } = vi.hoisted(() => ({ auth: { user: { id: 1, email: "raider@example.com" } } }));

vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/features/notifications/api/notifications-api", () => ({
  listNotifications: vi.fn(async () => []),
}));
vi.mock("@/features/campaigns/api/campaigns-api", () => ({
  listCampaignMessages: vi.fn(async () => []),
  sendCampaignMessage: vi.fn(),
}));
vi.mock("@/lib/realtime/client", () => ({
  subscribe: vi.fn(() => () => undefined),
  onConnectionRestored: vi.fn(() => () => undefined),
  disconnectRealtime: vi.fn(),
}));

const subscriptionsTo = (channel: string) =>
  vi.mocked(subscribe).mock.calls.filter(([name]) => name === channel);

const chatHandler = () => {
  const calls = subscriptionsTo("private-campaign-7-chat");
  return calls[calls.length - 1]?.[2] as (data: unknown) => void;
};

function ChatButtonThatComesAndGoes() {
  const [shown, setShown] = useState(true);
  return (
    <>
      <button onClick={() => setShown((value) => !value)}>Toggle top bar</button>
      {shown ? <CampaignChatMenu campaignId={7} /> : null}
    </>
  );
}

function renderApp(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        element: (
          <RealtimeProvider>
            <Outlet />
          </RealtimeProvider>
        ),
        children: [
          { path: "/campaigns", element: <p>Campaign list</p> },
          { path: "/campaigns/:id", element: <ChatButtonThatComesAndGoes /> },
        ],
      },
      { path: "/", element: <p>Landing</p> },
    ],
    { initialEntries: [initialPath] }
  );
  const result = renderWithQueryClient(
    <AppStoreProvider>
      <RouterProvider router={router} />
    </AppStoreProvider>
  );
  return { router, ...result };
}

describe("RealtimeProvider", () => {
  beforeEach(() => {
    vi.mocked(subscribe).mockClear();
    vi.mocked(onConnectionRestored).mockClear();
    vi.mocked(disconnectRealtime).mockClear();
  });

  it("keeps the notification subscription when moving between the list and a campaign", async () => {
    const { router } = renderApp("/campaigns");
    expect(await screen.findByText("Campaign list")).toBeInTheDocument();

    await act(() => router.navigate("/campaigns/7"));
    await act(() => router.navigate("/campaigns"));

    expect(subscriptionsTo("private-user-1-notifications")).toHaveLength(1);
    expect(subscriptionsTo("private-campaign-7-chat")).toHaveLength(1);
  });

  it("keeps the chat unread count when the chat button unmounts and comes back", async () => {
    renderApp("/campaigns/7");
    await waitFor(() => expect(chatHandler()).toBeDefined());

    act(() => chatHandler()({ id: 11, campaign_id: 7, user_id: 2, username: "Mira", body: "Hi" }));
    expect(await screen.findByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle top bar" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle top bar" }));

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(subscriptionsTo("private-campaign-7-chat")).toHaveLength(1);
  });

  it("refetches the campaign's queries when the connection comes back", async () => {
    const { queryClient } = renderApp("/campaigns/7");
    await waitFor(() => expect(onConnectionRestored).toHaveBeenCalled());
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    act(() => vi.mocked(onConnectionRestored).mock.calls.forEach(([listener]) => listener()));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["campaign", 7] });
  });

  it("closes the socket when the signed-in screens unmount", async () => {
    const { router } = renderApp("/campaigns");
    await screen.findByText("Campaign list");

    await act(() => router.navigate("/"));

    expect(disconnectRealtime).toHaveBeenCalledTimes(1);
  });
});
