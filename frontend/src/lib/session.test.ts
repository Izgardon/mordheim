/**
 * The session module on its own (IMP-92): where each write leaves the session, what it stores,
 * how many notifications it sends, and which changes reach the onChange handlers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/features/auth/types/auth-types";
import { accessToken, RAIDER, storeSession, tokensFor } from "@/test/auth-fixtures";
import { getRefreshToken, getStoredUser, getToken } from "@/utils/storage";
import { session, type SessionChange } from "./session";

const RIVAL: AuthUser = { id: 3, email: "rival@example.com", name: "Rival" };

let changes: SessionChange[];
let notifications: number;
let stops: (() => void)[];

function watch() {
  stops.push(session.onChange((change) => changes.push(change)));
  stops.push(session.subscribe(() => (notifications += 1)));
}

beforeEach(() => {
  localStorage.clear();
  changes = [];
  notifications = 0;
  stops = [];
});

afterEach(() => {
  stops.forEach((stop) => stop());
});

describe("boot", () => {
  it("is anonymous with nothing stored", () => {
    expect(session.boot()).toEqual({ status: "anonymous", token: null, user: null, ended: null });
  });

  it("is authenticated at once with the user cached beside the tokens (PERF-50)", () => {
    const tokens = storeSession(RAIDER);

    expect(session.boot()).toEqual({
      status: "authenticated",
      token: tokens.access,
      user: RAIDER,
      ended: null,
    });
  });

  it("is booting with no cached user, or one for another account", () => {
    storeSession(RAIDER, { cachedUser: false });
    expect(session.boot()).toMatchObject({ status: "booting", user: null });

    localStorage.setItem("mordheim_user", JSON.stringify(RIVAL));
    expect(session.boot()).toMatchObject({ status: "booting", user: null });
  });

  it("notifies nobody and forgets how the previous session ended", () => {
    storeSession(RAIDER);
    session.boot();
    session.end();
    expect(session.get().ended).toBe("ended");
    watch();

    expect(session.boot().ended).toBeNull();
    expect(notifications).toBe(0);
  });
});

describe("signing in and out", () => {
  it("start stores the tokens and the user in one write, with one notification and no change handler", () => {
    session.boot();
    watch();
    const tokens = tokensFor(RAIDER);

    session.start(tokens, RAIDER);

    expect(session.get()).toEqual({
      status: "authenticated",
      token: tokens.access,
      user: RAIDER,
      ended: null,
    });
    expect([getToken(), getRefreshToken(), getStoredUser()]).toEqual([
      tokens.access,
      tokens.refresh,
      RAIDER,
    ]);
    expect(notifications).toBe(1);
    expect(changes).toEqual([]);
  });

  it("signOut empties storage and says signed-out, with no change handler", () => {
    storeSession(RAIDER);
    session.boot();
    watch();

    session.signOut();

    expect(session.get()).toEqual({
      status: "anonymous",
      token: null,
      user: null,
      ended: "signed-out",
    });
    expect(localStorage.length).toBe(0);
    expect(notifications).toBe(1);
    expect(changes).toEqual([]);
  });
});

describe("tokens changed under the app", () => {
  it("a refreshed token for the same account only swaps the token, keeping the refresh token the answer lacks", () => {
    const tokens = storeSession(RAIDER);
    session.boot();
    watch();
    const refreshed = accessToken(RAIDER.id, "refreshed");

    session.setTokens({ access: refreshed });

    expect(session.get()).toEqual({
      status: "authenticated",
      token: refreshed,
      user: RAIDER,
      ended: null,
    });
    expect(getRefreshToken()).toBe(tokens.refresh);
    expect(changes).toEqual([{ kind: "refreshed" }]);
    expect(notifications).toBe(1);
  });

  it("counts a refresh as the same account before the profile has loaded (BUG-158)", () => {
    storeSession(RAIDER, { cachedUser: false });
    session.boot();
    watch();

    session.setTokens({ access: accessToken(RAIDER.id, "refreshed") });

    expect(changes).toEqual([{ kind: "refreshed" }]);
    expect(session.get().status).toBe("booting");
  });

  it("another account with its user cached is adopted at once", () => {
    storeSession(RAIDER);
    session.boot();
    watch();
    const rival = accessToken(RIVAL.id, "other-tab");

    session.setTokens({ access: rival, refresh: "refresh-3", user: RIVAL });

    expect(session.get()).toEqual({
      status: "authenticated",
      token: rival,
      user: RIVAL,
      ended: null,
    });
    expect(changes).toEqual([
      { kind: "switched", token: rival, previousUser: RAIDER, needsProfile: false },
    ]);
  });

  it("another account without its user asks for a profile, keeping the previous user until it loads", () => {
    storeSession(RAIDER);
    session.boot();
    watch();
    const rival = accessToken(RIVAL.id, "other-tab");

    session.setTokens({ access: rival });

    expect(session.get()).toMatchObject({ status: "authenticated", token: rival, user: RAIDER });
    expect(changes).toEqual([
      { kind: "switched", token: rival, previousUser: RAIDER, needsProfile: true },
    ]);
  });

  it("end empties storage and says ended, telling the handlers once", () => {
    storeSession(RAIDER);
    session.boot();
    watch();

    session.end();
    session.end();

    expect(session.get()).toEqual({ status: "anonymous", token: null, user: null, ended: "ended" });
    expect(localStorage.length).toBe(0);
    expect(changes).toEqual([{ kind: "ended" }]);
    expect(notifications).toBe(2);
  });

  it("follows another tab through the storage event while a handler listens, and not after", () => {
    storeSession(RAIDER);
    session.boot();
    watch();

    localStorage.clear();
    window.dispatchEvent(new StorageEvent("storage", { key: "mordheim_token" }));
    expect(changes).toEqual([{ kind: "ended" }]);

    stops.splice(0).forEach((stop) => stop());
    storeSession(RAIDER);
    window.dispatchEvent(new StorageEvent("storage", { key: "mordheim_token" }));
    expect(session.get().token).toBeNull();
    expect(changes).toHaveLength(1);
  });
});

describe("the profile", () => {
  it("loading, loaded and unavailable move the status, and a loaded user is cached", () => {
    storeSession(RAIDER, { cachedUser: false });
    session.boot();

    session.loadingProfile();
    session.profileUnavailable();
    expect(session.get()).toMatchObject({ status: "offline", user: null });

    session.loadingProfile();
    expect(session.get().status).toBe("booting");
    session.profileLoaded(RAIDER);
    expect(session.get()).toMatchObject({ status: "authenticated", user: RAIDER });
    expect(getStoredUser()).toEqual(RAIDER);
  });

  it("updateUser caches a newer copy and notifies only when it differs", () => {
    storeSession(RAIDER);
    session.boot();
    watch();

    session.updateUser({ ...RAIDER });
    expect(notifications).toBe(0);

    session.updateUser({ ...RAIDER, name: "Raider Prime" });
    expect(session.get().user?.name).toBe("Raider Prime");
    expect(getStoredUser()?.name).toBe("Raider Prime");
    expect(notifications).toBe(1);
  });

  it("notifies a subscriber nothing for a status it already has", () => {
    storeSession(RAIDER, { cachedUser: false });
    session.boot();
    const listener = vi.fn();
    stops.push(session.subscribe(listener));

    session.loadingProfile();

    expect(listener).not.toHaveBeenCalled();
  });
});
