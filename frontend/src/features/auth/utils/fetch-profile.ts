// api
import { fetchMe } from "../api/auth-api";
import { isSessionExpiredError } from "../../../lib/api-client";
import { session } from "../../../lib/session";

// types
import type { AuthUser } from "../types/auth-types";

// Back-off between profile retries while the server is unreachable (e.g. mid-deploy).
export const PROFILE_RETRY_DELAYS_MS = [1000, 2000, 4000];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** `/auth/me`, retried with back-off through an outage; a refused session throws at once. */
export async function fetchProfileWithRetry(accessToken: string) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchMe(accessToken);
    } catch (error) {
      if (isSessionExpiredError(error) || attempt >= PROFILE_RETRY_DELAYS_MS.length) {
        throw error;
      }
      await wait(PROFILE_RETRY_DELAYS_MS[attempt]);
    }
  }
}

/** One `/auth/me` read behind a cached user (PERF-50): the fresh profile, or why there is none. */
export async function revalidateProfile(
  accessToken: string
): Promise<AuthUser | "refused" | "unavailable"> {
  try {
    return await fetchMe(accessToken);
  } catch (error) {
    return isSessionExpiredError(error) ? "refused" : "unavailable";
  }
}

/**
 * Loads the session's user while the app waits behind LoadingScreen. A refused session ends; an
 * outage keeps the tokens and offers a retry (ConnectionErrorScreen). Once the session has moved
 * on (signed out, or another account), the outcome changes nothing (BUG-170).
 */
export async function loadSessionProfile(accessToken: string) {
  session.loadingProfile();
  try {
    session.profileLoaded(accessToken, await fetchProfileWithRetry(accessToken));
  } catch (error) {
    // Signed out or switched meanwhile: ending "this" session now would end the new one.
    const stillCurrent = session.isFor(accessToken);
    if (stillCurrent && isSessionExpiredError(error)) {
      session.end();
    } else if (stillCurrent) {
      session.profileUnavailable();
    }
    throw error;
  }
}

/**
 * Checks the cached user shown at boot, behind it: a refused session ends here, and an outage
 * keeps the cached user (the page's own reads say the server is down).
 */
export async function revalidateSessionUser(accessToken: string, cached: AuthUser) {
  const outcome = await revalidateProfile(accessToken);
  if (session.get().user?.id !== cached.id || outcome === "unavailable") {
    return; // signed out or switched meanwhile, or the server is down
  }
  if (outcome === "refused") {
    session.end();
  } else if (outcome.id === cached.id) {
    session.updateUser(outcome);
  }
}
