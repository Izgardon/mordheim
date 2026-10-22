// utils
import { getStoredUser } from "@/utils/storage";

// types
import type { AuthUser } from "../types/auth-types";

/**
 * The user id claim of a SimpleJWT access token, or null when it can't be read. The token is not
 * verified (the server does that); this only tells a refresh apart from an account switch.
 */
export function getTokenUserId(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as { user_id?: unknown };
    return claims.user_id === undefined || claims.user_id === null ? null : String(claims.user_id);
  } catch {
    return null;
  }
}

/** The user cached beside the tokens, when it is `token`'s account (PERF-50). */
export function cachedUserFor(token: string | null): AuthUser | null {
  const cached = token ? getStoredUser() : null;
  return cached && token && getTokenUserId(token) === String(cached.id) ? cached : null;
}
