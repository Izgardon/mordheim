// types
import type { SessionEnd } from "../stores/auth-context";

export const SESSION_ENDED_MESSAGE = "Your session ended. Please sign in again.";

type Page = { pathname: string; search: string; hash: string };

/** What the auth gate leaves in history state for the sign-in card (AUTH-UX-02). */
export type SignInRedirectState = { from: Page; reason?: "session-ended" };

/**
 * The state for the redirect to sign-in from `page`: the page to come back to, and the reason
 * when the session ended under the user. Log out keeps nothing: the next person to sign in on
 * the device starts from the campaigns list.
 */
export function signInRedirectState(
  page: Page,
  sessionEnd: SessionEnd | null
): SignInRedirectState | null {
  if (sessionEnd === "signed-out") {
    return null;
  }
  const from = { pathname: page.pathname, search: page.search, hash: page.hash };
  return sessionEnd === "ended" ? { from, reason: "session-ended" } : { from };
}

/** Where sign-in goes next: the page in the redirect state, or the campaigns list. */
export function returnPathFrom(state: unknown): string {
  const from = (state as { from?: Partial<Page> } | null)?.from;
  const pathname = typeof from?.pathname === "string" ? from.pathname : "";
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname === "/") {
    return "/campaigns";
  }
  return `${pathname}${from?.search ?? ""}${from?.hash ?? ""}`;
}

/** The sign-in card's notice when the last session ended under the user, else null. */
export function sessionEndedNotice(state: unknown): string | null {
  const reason = (state as { reason?: unknown } | null)?.reason;
  return reason === "session-ended" ? SESSION_ENDED_MESSAGE : null;
}
