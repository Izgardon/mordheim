const TOKEN_KEY = "mordheim_token";
const REFRESH_TOKEN_KEY = "mordheim_refresh_token";

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:tokens-changed"));
  }
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  notifyAuthChange();
}

/**
 * Stores the tokens of a sign-in, a sign-up or a refresh together and notifies once (PERF-50).
 * An answer without a refresh token keeps the stored one.
 */
export function setTokens({ access, refresh }: { access: string; refresh?: string }) {
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
  // Last, so another tab that sees the new access token sees the rest of the session too.
  localStorage.setItem(TOKEN_KEY, access);
  notifyAuthChange();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  notifyAuthChange();
}

export function setRefreshToken(token: string | null) {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  notifyAuthChange();
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
