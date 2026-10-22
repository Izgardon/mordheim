/**
 * Pass 6 characterisation: where `AuthProvider` keeps the session and what ending it clears.
 * Token storage on sign-in and sign-up, sign-out, and sessions changed in another tab. The
 * query cache and store resets themselves are BUG-22's (`stores/app-store.test.tsx`).
 */
import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BattleNudgeNotification } from "@/features/battles/types/battle-types";
import { AppStoreProvider, useAppStore } from "@/stores/app-store";
import {
  accessToken,
  countTokenEvents,
  loginAnswer,
  RAIDER,
  registerAnswer,
  storeSession,
} from "@/test/auth-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient } from "@/test/query-test-utils";
import { AuthProvider, useAuthContext } from "./auth-store";

const { disconnectRealtime } = vi.hoisted(() => ({ disconnectRealtime: vi.fn() }));

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", () => ({ disconnectRealtime }));

const RIVAL = { id: 3, email: "rival@example.com", name: "Rival" };

const NUDGE: BattleNudgeNotification = {
  id: "nudge-31",
  notificationDbId: 31,
  battleId: 5,
  campaignId: 1,
  scenario: "Street Fight",
  page: "active",
  fromLabel: "Raider",
  createdAt: "2026-10-20T19:00:00Z",
};

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

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  disconnectRealtime.mockClear();
});

describe("token storage", () => {
  it("keeps both tokens in localStorage, written together: one change event per sign-in (PERF-50)", async () => {
    const tokens = loginAnswer(RAIDER);
    fakeApi.on("POST /auth/login/", tokens);
    fakeApi.on("GET /auth/me/", RAIDER);
    const { result } = renderSession();
    const events = countTokenEvents();

    await act(async () => {
      await result.current.auth.signIn({ email: RAIDER.email, password: "wyrdstone" });
    });
    events.stop();

    expect(events.count()).toBe(1);
    expect(localStorage.getItem("mordheim_token")).toBe(tokens.access);
    expect(localStorage.getItem("mordheim_refresh_token")).toBe(tokens.refresh);
    expect(JSON.parse(localStorage.getItem("mordheim_user") ?? "null")).toEqual(RAIDER);
    expect(localStorage.length).toBe(3);
  });

  it("does the same on sign-up, with the user cached beside the tokens (PERF-50)", async () => {
    const answer = registerAnswer(RAIDER);
    fakeApi.on("POST /auth/register/", answer);
    fakeApi.on("GET /auth/me/", RAIDER);
    const { result } = renderSession();
    const events = countTokenEvents();

    await act(async () => {
      await result.current.auth.signUp({ name: "", email: RAIDER.email, password: "wyrdstone" });
    });
    events.stop();

    expect(events.count()).toBe(1);
    expect(Object.keys(localStorage).sort()).toEqual([
      "mordheim_refresh_token",
      "mordheim_token",
      "mordheim_user",
    ]);
    expect(JSON.parse(localStorage.getItem("mordheim_user") ?? "null")).toEqual(RAIDER);
  });
});

describe("signing out", () => {
  it("clears both tokens, the query cache and the socket (once: its own token event is skipped), and tells the server nothing", async () => {
    storeSession();
    fakeApi.on("GET /auth/me/", RAIDER);
    const { queryClient, result } = renderSession();
    await waitFor(() => expect(result.current.auth.user).toEqual(RAIDER));
    queryClient.setQueryData(["campaigns"], [{ id: 1 }]);
    fakeApi.clearRequests();

    act(() => result.current.auth.signOut());

    expect(localStorage.length).toBe(0);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(disconnectRealtime).toHaveBeenCalledTimes(1);
    expect(result.current.auth).toMatchObject({
      token: null,
      user: null,
      isReady: true,
      sessionEnd: "signed-out",
    });
    expect(fakeApi.calls()).toEqual([]);
  });

  it("drops the previous user's battle nudges, so the next one doesn't see them (BUG-157)", async () => {
    storeSession();
    fakeApi.on("GET /auth/me/", RAIDER);
    const { result } = renderSession();
    await waitFor(() => expect(result.current.auth.user).toEqual(RAIDER));
    act(() => result.current.store.addBattleNudgeNotification(NUDGE));

    act(() => result.current.auth.signOut());
    await waitFor(() => expect(result.current.auth.user).toBeNull());

    fakeApi.on("POST /auth/login/", loginAnswer(RIVAL));
    fakeApi.on("GET /auth/me/", RIVAL);
    await act(async () => {
      await result.current.auth.signIn({ email: RIVAL.email, password: "wyrdstone" });
    });

    expect(result.current.auth.user).toEqual(RIVAL);
    expect(result.current.store.tradeRequestNotifications).toEqual([]);
    expect(result.current.store.battleNudgeNotifications).toEqual([]);
  });
});

describe("a session changed in another tab", () => {
  it("signs this tab out too when the tokens are removed there", async () => {
    storeSession();
    fakeApi.on("GET /auth/me/", RAIDER);
    const { queryClient, result } = renderSession();
    await waitFor(() => expect(result.current.auth.user).toEqual(RAIDER));
    queryClient.setQueryData(["campaigns"], [{ id: 1 }]);

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: "mordheim_token" }));
    });

    await waitFor(() => expect(result.current.auth.user).toBeNull());
    expect(result.current.auth.token).toBeNull();
    expect(result.current.auth.sessionEnd).toBe("ended");
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(disconnectRealtime).toHaveBeenCalledTimes(1);
  });

  it("drops this user's cache and socket and loads the profile when another account signs in there", async () => {
    storeSession();
    fakeApi.on("GET /auth/me/", RAIDER);
    const { queryClient, result } = renderSession();
    await waitFor(() => expect(result.current.auth.user).toEqual(RAIDER));
    queryClient.setQueryData(["campaigns"], [{ id: 1 }]);
    fakeApi.on("GET /auth/me/", RIVAL);

    act(() => {
      localStorage.setItem("mordheim_token", accessToken(RIVAL.id, "other-tab"));
      window.dispatchEvent(new StorageEvent("storage", { key: "mordheim_token" }));
    });

    await waitFor(() => expect(result.current.auth.user).toEqual(RIVAL));
    expect(queryClient.getQueryData(["campaigns"])).toBeUndefined();
    expect(disconnectRealtime).toHaveBeenCalledTimes(1);
    expect(fakeApi.countOf("GET /auth/me/")).toBe(2);
  });
});
