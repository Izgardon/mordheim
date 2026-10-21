/**
 * Users, tokens and sessions for the auth tests, in the API's shapes: `/auth/me/` answers
 * `{id, email, name}`, login answers `{access, refresh}` and register adds the `user`.
 */
import type { AuthResponse, AuthTokens, AuthUser } from "@/features/auth/types/auth-types";
import { setTokens } from "@/utils/storage";

/** An unsigned JWT-shaped token: the client reads only its payload's `user_id`. */
export function accessToken(userId: number, nonce = "a") {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ user_id: userId, jti: nonce })}.sig`;
}

export const RAIDER: AuthUser = { id: 1, email: "raider@example.com", name: "Raider" };

/** Signed up without an alias, which today's sign-up allows (decision 2 makes it required). */
export const NAMELESS: AuthUser = { id: 2, email: "nameless@example.com", name: "" };

/** A token pair for `user`, as login or a refresh would issue it. */
export function tokensFor(user: AuthUser, nonce = "login"): AuthTokens {
  return { access: accessToken(user.id, nonce), refresh: `refresh-${user.id}-${nonce}` };
}

/** What `POST /auth/register/` answers. */
export function registerAnswer(user: AuthUser): AuthResponse {
  return { ...tokensFor(user, "register"), user };
}

/**
 * Leaves a session in localStorage, as an earlier visit would: the tokens and the user cached
 * beside them. `cachedUser: false` leaves only the tokens, as sessions stored before PR A have.
 */
export function storeSession(user: AuthUser = RAIDER, { cachedUser = true } = {}) {
  const tokens = tokensFor(user, "stored");
  setTokens({ ...tokens, user: cachedUser ? user : undefined });
  return tokens;
}

/** A promise with its resolve and reject in hand, to hold an answer back. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Counts the `auth:tokens-changed` events storage dispatches until `stop()` is called. */
export function countTokenEvents() {
  let count = 0;
  const listener = () => {
    count += 1;
  };
  window.addEventListener("auth:tokens-changed", listener);
  return {
    count: () => count,
    stop: () => window.removeEventListener("auth:tokens-changed", listener),
  };
}
