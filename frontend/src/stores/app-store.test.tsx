import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuthContext } from "@/features/auth/stores/auth-store";
import { createTestQueryClient } from "@/test/query-test-utils";
import { session } from "@/lib/session";
import { AppStoreProvider, useAppStore } from "./app-store";

import type {
  BattleInviteNotification,
  BattleNudgeNotification,
} from "@/features/battles/types/battle-types";
import type { TradeNotification } from "@/features/warbands/types/trade-request-types";
import type { Warband } from "@/features/warbands/types/warband-types";

const { fetchMe, loginAccount } = vi.hoisted(() => ({ fetchMe: vi.fn(), loginAccount: vi.fn() }));

vi.mock("@/features/auth/api/auth-api", () => ({
  fetchMe,
  loginAccount,
  registerAccount: vi.fn(),
}));

const alice = { id: 1, email: "alice@example.com", name: "Alice" };
const bob = { id: 2, email: "bob@example.com", name: "Bob" };

function renderSession() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppStoreProvider>{children}</AppStoreProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(() => ({ auth: useAuthContext(), store: useAppStore() }), { wrapper });
  return { queryClient, ...hook };
}

/** Fills the store and the query cache the way a session at the table would. */
function seedAliceSession(
  queryClient: ReturnType<typeof createTestQueryClient>,
  store: ReturnType<typeof useAppStore>
) {
  queryClient.setQueryData(["campaign", 7, "detail"], { id: 7, name: "Alice's campaign" });
  act(() => {
    store.setWarband({ id: 3, campaign_id: 7, name: "Alice's Wolves" } as Warband);
    store.addTradeRequestNotification({ id: "trade-1" } as TradeNotification);
    store.addBattleInviteNotification({ id: "invite-1" } as BattleInviteNotification);
    store.addBattleNudgeNotification({ id: "nudge-1", battleId: 31 } as BattleNudgeNotification);
    store.setCurrentBattleSession({ battleId: 31, campaignId: 7, status: "active" });
  });
}

function expectEmptySession(
  queryClient: ReturnType<typeof createTestQueryClient>,
  store: ReturnType<typeof useAppStore>
) {
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(store.warband).toBeNull();
  expect(store.tradeRequestNotifications).toEqual([]);
  expect(store.battleInviteNotifications).toEqual([]);
  expect(store.battleResultRequestNotifications).toEqual([]);
  expect(store.battleNudgeNotifications).toEqual([]);
  expect(store.currentBattleSession).toBeNull();
}

describe("sign-out clears the previous user's data (BUG-22)", () => {
  beforeEach(() => {
    localStorage.clear();
    session.setTokens({ access: "alice-access", refresh: "alice-refresh" });
    fetchMe.mockReset();
    fetchMe.mockResolvedValue(alice);
    loginAccount.mockReset();
  });

  it("leaves nothing of user A for user B on a shared device", async () => {
    const { queryClient, result } = renderSession();
    await waitFor(() => expect(result.current.auth.user).toEqual(alice));
    seedAliceSession(queryClient, result.current.store);
    expect(result.current.store.tradeRequestNotifications).toHaveLength(1);

    act(() => result.current.auth.signOut());

    await waitFor(() => expect(result.current.auth.user).toBeNull());
    expectEmptySession(queryClient, result.current.store);

    loginAccount.mockResolvedValue({ access: "bob-access", refresh: "bob-refresh", user: bob });
    fetchMe.mockResolvedValue(bob);
    await act(async () => {
      await result.current.auth.signIn({ email: bob.email, password: "pw" });
    });

    expect(result.current.auth.user).toEqual(bob);
    expectEmptySession(queryClient, result.current.store);
  });

  it("also clears when the session ends because the refresh token was rejected", async () => {
    const { queryClient, result } = renderSession();
    await waitFor(() => expect(result.current.auth.user).toEqual(alice));
    seedAliceSession(queryClient, result.current.store);

    // What api-client does when /auth/refresh/ answers 401.
    act(() => session.end());

    await waitFor(() => expect(result.current.auth.user).toBeNull());
    expectEmptySession(queryClient, result.current.store);
  });
});
