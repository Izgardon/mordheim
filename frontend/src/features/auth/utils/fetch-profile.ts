// api
import { fetchMe } from "../api/auth-api";
import { isSessionExpiredError } from "../../../lib/api-client";

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
