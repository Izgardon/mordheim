import { act, renderHook, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppToaster } from "@/components/ui/toaster";
import type { BattleInviteNotification } from "@/features/battles/types/battle-types";
import { declineBattleInvite } from "@/features/battles/api/battles-api";
import { clearAllNotifications } from "@/features/notifications/api/notifications-api";
import { AppStoreProvider, useAppStore } from "@/stores/app-store";
import { createQueryWrapper } from "@/test/query-test-utils";
import { useNotifications } from "./useNotifications";

const { auth } = vi.hoisted(() => ({ auth: { user: { id: 1, email: "raider@example.com" } } }));

vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/features/notifications/api/notifications-api", () => ({
  clearAllNotifications: vi.fn(),
}));
vi.mock("@/features/battles/api/battles-api", () => ({ declineBattleInvite: vi.fn() }));

const invite: BattleInviteNotification = {
  id: "battle-41",
  notificationDbId: 12,
  battleId: 41,
  campaignId: 7,
  title: "Ambush",
  scenario: "",
  battleDate: "",
  createdByUserId: 2,
  createdByLabel: "Mira",
  createdAt: "2026-10-17T10:00:00Z",
};

const QueryWrapper = createQueryWrapper();
const wrapper = ({ children }: PropsWithChildren) => (
  <QueryWrapper>
    <AppStoreProvider>
      <MemoryRouter>
        {children}
        <AppToaster />
      </MemoryRouter>
    </AppStoreProvider>
  </QueryWrapper>
);

const renderNotifications = () =>
  renderHook(() => ({ ...useNotifications(), store: useAppStore() }), { wrapper });

describe("useNotifications", () => {
  beforeEach(() => {
    vi.mocked(declineBattleInvite).mockReset();
    vi.mocked(clearAllNotifications).mockReset();
  });

  it("keeps a battle invite, and reports the failure, when declining it fails", async () => {
    vi.mocked(declineBattleInvite).mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderNotifications();
    act(() => result.current.store.addBattleInviteNotification(invite));

    await act(async () => {
      await expect(result.current.declineBattleInviteNotification(invite)).rejects.toThrow();
    });

    expect(result.current.battleInviteNotifications).toEqual([invite]);
  });

  it("declines the battle through decline/, then removes the invite and its battle session (BUG-45)", async () => {
    vi.mocked(declineBattleInvite).mockResolvedValue({} as never);
    const { result } = renderNotifications();
    act(() => {
      result.current.store.addBattleInviteNotification(invite);
      result.current.store.setCurrentBattleSession({
        battleId: 41,
        campaignId: 7,
        status: "inviting",
      });
    });

    await act(() => result.current.declineBattleInviteNotification(invite));

    expect(declineBattleInvite).toHaveBeenCalledWith(7, 41);
    expect(result.current.battleInviteNotifications).toEqual([]);
    expect(result.current.store.currentBattleSession).toBeNull();
  });

  it("tells the user when clearing notifications fails on the server", async () => {
    vi.mocked(clearAllNotifications).mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderNotifications();

    act(() => result.current.clearNotifications());

    expect(
      await screen.findByText("Can't reach the server right now. Please try again.")
    ).toBeInTheDocument();
  });
});
