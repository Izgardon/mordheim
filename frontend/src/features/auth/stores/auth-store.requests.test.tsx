/**
 * Pass 6 characterisation: the requests `AuthProvider` sends, through the fake API server.
 * Signing in and up (AUTH-TEST-22), and a reload behind `ProtectedRoute` (AUTH-TEST-23).
 */
import type { PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProtectedRoute from "@/components/ProtectedRoute";
import { listCampaigns } from "@/features/campaigns/api/campaigns-api";
import { ApiError, SERVER_UNAVAILABLE_MESSAGE } from "@/lib/api-client";
import { deferred, RAIDER, registerAnswer, storeSession, tokensFor } from "@/test/auth-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createQueryWrapper } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { getRefreshToken, getToken } from "@/utils/storage";
import { AuthProvider, PROFILE_RETRY_DELAYS_MS, useAuthContext } from "./auth-store";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", () => ({ disconnectRealtime: vi.fn() }));

const QueryWrapper = createQueryWrapper();
const authWrapper = ({ children }: PropsWithChildren) => (
  <QueryWrapper>
    <AuthProvider>{children}</AuthProvider>
  </QueryWrapper>
);

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
});

describe("signing in and up (AUTH-TEST-22)", () => {
  it("signs in with the email as typed and reads no /auth/me when login's answer carries the user (PERF-50, AUTH-TEST-22)", async () => {
    const answer = { ...tokensFor(RAIDER), user: RAIDER };
    fakeApi.on("POST /auth/login/", answer);
    fakeApi.on("GET /auth/me/", RAIDER);
    const { result } = renderHook(() => useAuthContext(), { wrapper: authWrapper });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.signIn({
        email: "Raider@Example.com",
        password: "wyrdstone",
      });
    });

    expect(returned).toEqual(answer);
    expect(fakeApi.calls()).toEqual(["POST /auth/login/"]);
    expect(fakeApi.bodyOf("POST /auth/login/")).toEqual({
      email: "Raider@Example.com",
      password: "wyrdstone",
    });
    expect(result.current.user).toEqual(RAIDER);
    expect(result.current.token).toBe(answer.access);
  });

  it("reads /auth/me once when login's answer has only the tokens, as the server sends it before its PR A (PERF-50)", async () => {
    const tokens = tokensFor(RAIDER);
    fakeApi.on("POST /auth/login/", tokens);
    fakeApi.on("GET /auth/me/", RAIDER);
    const { result } = renderHook(() => useAuthContext(), { wrapper: authWrapper });

    await act(async () => {
      await result.current.signIn({ email: RAIDER.email, password: "wyrdstone" });
    });

    expect(fakeApi.calls()).toEqual(["POST /auth/login/", "GET /auth/me/"]);
    expect(result.current.user).toEqual(RAIDER);
    expect(result.current.token).toBe(tokens.access);
    expect(getToken()).toBe(tokens.access);
    expect(getRefreshToken()).toBe(tokens.refresh);
  });

  it("signs up and reads no /auth/me: the answer carries the user (PERF-50, AUTH-TEST-22)", async () => {
    const answer = registerAnswer(RAIDER);
    fakeApi.on("POST /auth/register/", answer);
    fakeApi.on("GET /auth/me/", RAIDER);
    const { result } = renderHook(() => useAuthContext(), { wrapper: authWrapper });

    await act(async () => {
      await result.current.signUp({ name: "Raider", email: RAIDER.email, password: "wyrdstone" });
    });

    expect(fakeApi.calls()).toEqual(["POST /auth/register/"]);
    expect(fakeApi.bodyOf("POST /auth/register/")).toEqual({
      name: "Raider",
      email: RAIDER.email,
      password: "wyrdstone",
    });
    expect(result.current.user).toEqual(RAIDER);
  });

  it("stores nothing and reads nothing more when the sign-in is refused", async () => {
    fakeApi.fail(
      "POST /auth/login/",
      new ApiError("Invalid credentials", 400, { non_field_errors: ["Invalid credentials"] })
    );
    const { result } = renderHook(() => useAuthContext(), { wrapper: authWrapper });

    let error: unknown;
    await act(async () => {
      error = await result.current
        .signIn({ email: RAIDER.email, password: "wrong" })
        .catch((caught: unknown) => caught);
    });

    expect(error).toMatchObject({ status: 400, message: "Invalid credentials" });
    expect(fakeApi.calls()).toEqual(["POST /auth/login/"]);
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(result.current).toMatchObject({ token: null, user: null, isSubmitting: false });
  });
});

/** A signed-in page that reads the campaigns list as soon as it mounts, as the real one does. */
function CampaignsPage() {
  const list = useQuery({ queryKey: ["campaigns"], queryFn: () => listCampaigns() });
  return <p>Campaigns page ({list.data?.length ?? "…"})</p>;
}

function renderReload() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/campaigns"]}>
        <Routes>
          <Route path="/" element={<p>Landing page</p>} />
          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
                <CampaignsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
    { wrapper: createQueryWrapper() }
  );
}

describe("a reload (AUTH-TEST-23)", () => {
  it("shows LoadingScreen and sends nothing else until /auth/me answers (PERF-50, AUTH-TEST-23, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (PERF-50, pinned; flips in PR A)
    storeSession();
    const me = deferred<typeof RAIDER>();
    fakeApi.on("GET /auth/me/", () => me.promise);
    fakeApi.on("GET /campaigns/", []);
    renderReload();

    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    await waitFor(() => expect(fakeApi.calls()).toEqual(["GET /auth/me/"]));
    expect(screen.queryByText(/Campaigns page/)).toBeNull();

    await act(async () => me.resolve(RAIDER));

    expect(await screen.findByText("Campaigns page (0)")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual(["GET /auth/me/", "GET /campaigns/"]);
  });

  it("reads nothing without a stored session, and the gate sends you to the landing page", async () => {
    renderReload();

    expect(await screen.findByText("Landing page")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([]);
  });
});

describe("a reload while the server is down", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads /auth/me four times over seven seconds, then offers Retry with the session kept", async () => {
    const tokens = storeSession();
    fakeApi.fail("GET /auth/me/", new ApiError("Service Unavailable", 503, null));
    renderReload();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0));
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(SERVER_UNAVAILABLE_MESSAGE);
    expect(fakeApi.countOf("GET /auth/me/")).toBe(4);
    expect(getToken()).toBe(tokens.access);
    expect(getRefreshToken()).toBe(tokens.refresh);

    fakeApi.on("GET /auth/me/", RAIDER);
    fakeApi.on("GET /campaigns/", []);
    await setupUser().click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Campaigns page (0)")).toBeInTheDocument();
    expect(fakeApi.countOf("GET /auth/me/")).toBe(5);
  });
});
