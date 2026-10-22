import type { AuthUser } from "@/features/auth/types/auth-types";

/**
 * Where the session is kept between visits. Only `lib/session.ts` writes it, and it tells the
 * app; these functions notify nobody.
 */
const TOKEN_KEY = "mordheim_token";
const REFRESH_TOKEN_KEY = "mordheim_refresh_token";
const USER_KEY = "mordheim_user";

type StoredSession = {
  access: string;
  refresh?: string;
  /** The signed-in user, cached so a reload renders at once; null removes it, undefined keeps it. */
  user?: AuthUser | null;
};

/** Writes a session's tokens together. An answer without a refresh token keeps the stored one. */
export function writeSession({ access, refresh, user }: StoredSession) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else if (user === null) {
    localStorage.removeItem(USER_KEY);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
  // Last, so another tab that sees the new access token sees the rest of the session too.
  localStorage.setItem(TOKEN_KEY, access);
}

/** Removes the tokens and the cached user, so nothing of the session stays on a shared device. */
export function removeSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** The user cached beside the tokens, or null when there is none or it can't be read. */
export function getStoredUser(): AuthUser | null {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) ?? "null") as Partial<AuthUser> | null;
    return user && typeof user.id === "number" && typeof user.email === "string"
      ? (user as AuthUser)
      : null;
  } catch {
    return null;
  }
}

/** Refreshes the cached user (a newer /auth/me answer). The tokens are unchanged. */
export function setStoredUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
