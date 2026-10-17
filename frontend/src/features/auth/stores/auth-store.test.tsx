import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProtectedRoute from "../../../components/ProtectedRoute";
import { createQueryWrapper } from "../../../test/query-test-utils";
import { ApiError, SERVER_UNAVAILABLE_MESSAGE } from "../../../lib/api-client";
import { getRefreshToken, getToken, setRefreshToken, setToken } from "../../../utils/storage";
import { AuthProvider, PROFILE_RETRY_DELAYS_MS, useAuthContext } from "./auth-store";

const { fetchMe } = vi.hoisted(() => ({ fetchMe: vi.fn() }));

vi.mock("../api/auth-api", () => ({
  fetchMe,
  loginAccount: vi.fn(),
  registerAccount: vi.fn(),
}));

vi.mock("../../realtime/hooks/useNotifications", () => ({ useNotifications: () => undefined }));
vi.mock("../../../components/ui/loading-screen", () => ({
  LoadingScreen: () => <p>Loading...</p>,
}));

const QueryWrapper = createQueryWrapper();
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryWrapper>
    <AuthProvider>{children}</AuthProvider>
  </QueryWrapper>
);
const profile = { id: 1, email: "raider@example.com", name: "Raider" };
const totalRetryMs = PROFILE_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);

describe("AuthProvider boot", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
    setToken("access");
    setRefreshToken("refresh");
    fetchMe.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the profile for a stored session", async () => {
    fetchMe.mockResolvedValue(profile);
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(profile));
    expect(result.current.connectionError).toBeNull();
  });

  it("keeps the session and offers a retry when the server is unreachable", async () => {
    fetchMe.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(totalRetryMs + 100);
    });

    await waitFor(() => expect(result.current.connectionError).toBe(SERVER_UNAVAILABLE_MESSAGE));
    expect(fetchMe).toHaveBeenCalledTimes(PROFILE_RETRY_DELAYS_MS.length + 1);
    expect(result.current.token).toBe("access");
    expect(getToken()).toBe("access");
    expect(getRefreshToken()).toBe("refresh");

    fetchMe.mockResolvedValue(profile);
    act(() => result.current.retryConnection());

    await waitFor(() => expect(result.current.user).toEqual(profile));
    expect(result.current.connectionError).toBeNull();
  });

  it("signs out when the session has expired", async () => {
    fetchMe.mockRejectedValue(new ApiError("Token is invalid or expired", 401, null));
    const { result } = renderHook(() => useAuthContext(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    await waitFor(() => expect(result.current.token).toBeNull());
    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
    expect(result.current.connectionError).toBeNull();
  });
});

/** An unsigned JWT-shaped token: only the payload matters to the client. */
function accessToken(userId: number, nonce: string) {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ user_id: userId, jti: nonce })}.sig`;
}

const mountCount = vi.fn();

function DraftEditor() {
  const { token } = useAuthContext();
  const [draft, setDraft] = useState("");
  useEffect(() => {
    mountCount();
  }, []);
  return (
    <div>
      <input
        aria-label="Chat draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <span data-testid="token">{token}</span>
    </div>
  );
}

function renderProtectedApp() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <ProtectedRoute>
          <DraftEditor />
        </ProtectedRoute>
      </MemoryRouter>
    </AuthProvider>,
    { wrapper: createQueryWrapper() }
  );
}

describe("AuthProvider token refresh (BUG-21)", () => {
  beforeEach(() => {
    localStorage.clear();
    setToken(accessToken(1, "first"));
    setRefreshToken("refresh");
    fetchMe.mockReset();
    fetchMe.mockResolvedValue(profile);
    mountCount.mockReset();
  });

  it("keeps the app mounted when the access token is refreshed for the same user", async () => {
    renderProtectedApp();
    const input = await screen.findByLabelText("Chat draft");
    fireEvent.change(input, { target: { value: "Charge the left flank" } });

    const refreshed = accessToken(1, "second");
    act(() => setToken(refreshed));

    await waitFor(() => expect(screen.getByTestId("token")).toHaveTextContent(refreshed));
    expect(screen.getByLabelText("Chat draft")).toHaveValue("Charge the left flank");
    expect(mountCount).toHaveBeenCalledTimes(1);
    expect(fetchMe).toHaveBeenCalledTimes(1);
  });

  it("keeps the app mounted when another tab refreshes the token", async () => {
    renderProtectedApp();
    const input = await screen.findByLabelText("Chat draft");
    fireEvent.change(input, { target: { value: "Hold the bridge" } });

    act(() => {
      localStorage.setItem("mordheim_token", accessToken(1, "other-tab"));
      window.dispatchEvent(new StorageEvent("storage", { key: "mordheim_token" }));
    });

    await waitFor(() =>
      expect(screen.getByTestId("token")).toHaveTextContent(accessToken(1, "other-tab"))
    );
    expect(screen.getByLabelText("Chat draft")).toHaveValue("Hold the bridge");
    expect(fetchMe).toHaveBeenCalledTimes(1);
  });

  it("still loads the new profile when the token belongs to another account", async () => {
    renderProtectedApp();
    await screen.findByLabelText("Chat draft");
    fetchMe.mockResolvedValue({ id: 2, email: "rival@example.com", name: "Rival" });

    act(() => setToken(accessToken(2, "switch")));

    await waitFor(() => expect(fetchMe).toHaveBeenCalledTimes(2));
  });
});
