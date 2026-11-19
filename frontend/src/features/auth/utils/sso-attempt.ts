/**
 * The sign-in attempt this browser started, kept in sessionStorage across the trip to the
 * provider and back.
 *
 * The server stores only the hash of `browser_token`, so a `state` lifted from the redirect URL
 * (a shared link, a browser history, a server log) can't be redeemed anywhere else. The attempt
 * is read once and cleared, whether it worked or not.
 *
 * sessionStorage, not localStorage: it belongs to this tab and this visit. Private windows and
 * blocked site data make it throw, so every access is guarded.
 */

const KEY = "mordheim_sso_attempt";

export type SsoAttempt = {
  provider: string;
  state: string;
  browserToken: string;
};

export function rememberSsoAttempt(attempt: SsoAttempt) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(attempt));
  } catch {
    // A browser that won't store it can't finish a sign-in; the callback says so.
  }
}

/** The stored attempt, removed as it is read; null when there is none or it can't be read. */
export function takeSsoAttempt(): SsoAttempt | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const attempt = JSON.parse(raw) as Partial<SsoAttempt> | null;
    return attempt &&
      typeof attempt.provider === "string" &&
      typeof attempt.state === "string" &&
      typeof attempt.browserToken === "string"
      ? (attempt as SsoAttempt)
      : null;
  } catch {
    return null;
  }
}
