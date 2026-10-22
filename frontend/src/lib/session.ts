/**
 * The signed-in session, in one place (IMP-92, AUTH-CQ-05): the tokens and the user cached
 * beside them in localStorage, the user in memory, and where the session stands. AuthProvider
 * renders it through `useSession` (useSyncExternalStore); the API client stores refreshed tokens
 * here and ends a session the server refuses; the realtime client reads the access token.
 *
 * A change the app doesn't make through the provider (a refresh, another tab, a refused session)
 * reaches the `onChange` handlers, so the provider can drop the previous user's data and load a
 * new profile. Every write notifies subscribers once (PERF-50).
 */
import { useSyncExternalStore } from "react";

// utils
import { cachedUserFor, getTokenUserId } from "@/features/auth/utils/token-user";
import {
  getRefreshToken,
  getToken,
  removeSession,
  setStoredUser,
  writeSession,
} from "@/utils/storage";

// types
import type { AuthTokens, AuthUser } from "@/features/auth/types/auth-types";

/**
 * `booting`: a stored session whose user is loading (behind LoadingScreen). `offline`: its user
 * couldn't be loaded because the server is unreachable; the session is kept for a retry.
 */
export type SessionStatus = "booting" | "authenticated" | "anonymous" | "offline";

/** How the last session ended: by Log out, or under the user (refused by the server, or another tab). */
export type SessionEnd = "signed-out" | "ended";

export type Session = Readonly<{
  status: SessionStatus;
  /** The access token. */
  token: string | null;
  user: AuthUser | null;
  /** Null until a session ends in this visit; the gate tells the sign-in card why (AUTH-UX-02). */
  ended: SessionEnd | null;
}>;

/** A change made under the app: a refreshed token, another account, or a session gone. */
export type SessionChange =
  | { kind: "refreshed" }
  | { kind: "switched"; token: string; previousUser: AuthUser | null; needsProfile: boolean }
  | { kind: "ended" };

let current: Session = { status: "anonymous", token: null, user: null, ended: null };
const listeners = new Set<() => void>();
const changeHandlers = new Set<(change: SessionChange) => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function update(patch: Partial<Session>) {
  const next = { ...current, ...patch };
  const keys = Object.keys(next) as (keyof Session)[];
  if (keys.some((key) => next[key] !== current[key])) {
    current = next;
    notify();
  }
}

/** Brings the session in line with the stored access token, and says what changed. */
function reconcile(token: string | null): SessionChange | null {
  const previous = current;
  if (token === previous.token) {
    return null;
  }
  if (!token) {
    // Signed out elsewhere, or the server refused the session: the sign-in card says it ended.
    current = { status: "anonymous", token: null, user: null, ended: "ended" };
    return { kind: "ended" };
  }
  // A refreshed token for this account (from this tab or another) only swaps the token, so the
  // app stays mounted (BUG-21). Before the profile has loaded too, so a reload with an expired
  // token loads it once (BUG-158).
  const accountId = previous.user
    ? String(previous.user.id)
    : previous.token && getTokenUserId(previous.token);
  const tokenUserId = getTokenUserId(token);
  if (tokenUserId !== null && tokenUserId === accountId) {
    current = { ...previous, token };
    return { kind: "refreshed" };
  }
  // Another account signed in (in another tab), which cached its user beside the tokens, or
  // whose profile has to be loaded.
  const cached = cachedUserFor(token);
  current = cached
    ? { status: "authenticated", token, user: cached, ended: null }
    : { ...previous, token, ended: null };
  return { kind: "switched", token, previousUser: previous.user, needsProfile: !cached };
}

function announce(change: SessionChange | null) {
  if (change) {
    changeHandlers.forEach((handler) => handler(change));
  }
  notify();
}

/** Reconciles with localStorage: on mount, and when another tab changes the session. */
function sync() {
  const change = reconcile(getToken());
  if (change) {
    announce(change);
  }
}

export const session = {
  get: (): Session => current,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Handlers for changes made under the app; another tab's changes arrive while one is set. */
  onChange(handler: (change: SessionChange) => void) {
    changeHandlers.add(handler);
    if (changeHandlers.size === 1) {
      window.addEventListener("storage", sync);
    }
    return () => {
      changeHandlers.delete(handler);
      if (changeHandlers.size === 0) {
        window.removeEventListener("storage", sync);
      }
    };
  },

  sync,

  accessToken: getToken,
  refreshToken: getRefreshToken,

  /**
   * Starts the session from what localStorage holds, when the provider mounts: ready at once with
   * the user cached beside the tokens, booting without one (PERF-50). Notifies nobody.
   */
  boot(): Session {
    const token = getToken();
    const user = cachedUserFor(token);
    current = {
      status: !token ? "anonymous" : user ? "authenticated" : "booting",
      token,
      user,
      ended: null,
    };
    return current;
  },

  /** A sign-in or sign-up: the tokens and the user they came with, in one write. */
  start(tokens: AuthTokens, user: AuthUser) {
    current = { status: "authenticated", token: tokens.access, user, ended: null };
    writeSession({ access: tokens.access, refresh: tokens.refresh, user });
    notify();
  },

  /**
   * New tokens from the server: a refresh, whose `refresh` is kept when the answer has none
   * (decision 4, AUTH-TWEAK-03). `user` is cached beside them; null removes the cached one.
   */
  setTokens(tokens: { access: string; refresh?: string; user?: AuthUser | null }) {
    writeSession(tokens);
    announce(reconcile(tokens.access));
  },

  /** The server refused the session (or it ended elsewhere): drop it, as ended, not logged out. */
  end() {
    removeSession();
    announce(reconcile(null));
  },

  /** Log out on this device: no reason for the sign-in card, and no change handlers. */
  signOut() {
    current = { status: "anonymous", token: null, user: null, ended: "signed-out" };
    removeSession();
    notify();
  },

  loadingProfile() {
    update({ status: "booting" });
  },

  profileLoaded(user: AuthUser) {
    if (getToken()) {
      setStoredUser(user);
    }
    update({ user, status: current.token ? "authenticated" : "anonymous" });
  },

  /** The server is unreachable: an outage isn't a logout, so the tokens stay for a retry. */
  profileUnavailable() {
    update({ user: null, status: "offline" });
  },

  /** A newer copy of the signed-in user (a fresh /auth/me answer): cached, and shown if changed. */
  updateUser(user: AuthUser) {
    setStoredUser(user);
    if (JSON.stringify(user) !== JSON.stringify(current.user)) {
      update({ user });
    }
  },
};

/** The session, re-rendering on every change. */
export function useSession() {
  return useSyncExternalStore(session.subscribe, session.get);
}
