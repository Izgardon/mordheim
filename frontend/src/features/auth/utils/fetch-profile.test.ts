/**
 * Loading the session's profile behind LoadingScreen, when the session moves on before /auth/me
 * answers (BUG-170): the late answer, a profile or a refusal, leaves the new session alone.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { session } from "@/lib/session";
import { accessToken, deferred, RAIDER, storeSession } from "@/test/auth-fixtures";
import { fakeApi } from "@/test/fake-api";
import { getStoredUser, getToken } from "@/utils/storage";
import type { AuthUser } from "../types/auth-types";
import { loadSessionProfile } from "./fetch-profile";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const RIVAL: AuthUser = { id: 3, email: "rival@example.com", name: "Rival" };

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
});

describe("loadSessionProfile (BUG-170)", () => {
  it("a profile that answers after a sign-out doesn't sign the user back in", async () => {
    storeSession(RAIDER, { cachedUser: false });
    const { token } = session.boot();
    const answer = deferred<AuthUser>();
    fakeApi.on("GET /auth/me/", () => answer.promise);
    const loading = loadSessionProfile(token!);

    session.signOut();
    answer.resolve(RAIDER);
    await loading;

    expect(session.get()).toMatchObject({ status: "anonymous", user: null, ended: "signed-out" });
    expect(getStoredUser()).toBeNull();
  });

  it("a refusal that answers after another tab switched account doesn't end the new session", async () => {
    storeSession(RAIDER, { cachedUser: false });
    const { token } = session.boot();
    const answer = deferred<AuthUser>();
    fakeApi.on("GET /auth/me/", () => answer.promise);
    const loading = loadSessionProfile(token!);
    const rival = accessToken(RIVAL.id, "other-tab");
    session.setTokens({ access: rival, refresh: "refresh-3", user: RIVAL });

    answer.reject(new ApiError("Your session has ended.", 401, { code: "session_ended" }));
    await expect(loading).rejects.toBeInstanceOf(ApiError);

    expect(session.get()).toMatchObject({ status: "authenticated", token: rival, user: RIVAL });
    expect(getToken()).toBe(rival);
  });
});
