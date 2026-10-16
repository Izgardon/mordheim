import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, SERVER_UNAVAILABLE_MESSAGE } from "../../../lib/api-client";
import { getRefreshToken, getToken, setRefreshToken, setToken } from "../../../utils/storage";
import { AuthProvider, PROFILE_RETRY_DELAYS_MS, useAuthContext } from "./auth-store";

const { fetchMe } = vi.hoisted(() => ({ fetchMe: vi.fn() }));

vi.mock("../api/auth-api", () => ({
  fetchMe,
  loginAccount: vi.fn(),
  registerAccount: vi.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
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
