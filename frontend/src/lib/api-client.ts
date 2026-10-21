// config
import { API_BASE_URL } from "../config/env";

// utils
import { reportApiRefusal } from "./api-refusals";
import { clearToken, getRefreshToken, getToken, setTokens } from "../utils/storage";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  /** Cancels the request (TanStack Query passes one to every query function). */
  signal?: AbortSignal;
};

export const SERVER_UNAVAILABLE_MESSAGE = "Can't reach the server right now. Please try again.";
export const REQUEST_TIMEOUT_MESSAGE = "The server took too long to respond. Please try again.";
export const REQUEST_ABORTED_MESSAGE = "The request was cancelled.";

/** A hung request gives up after this long instead of leaving spinners up forever. */
export const REQUEST_TIMEOUT_MS = 20_000;

/** True only when the server has definitively rejected the session (not for outages). */
export function isSessionExpiredError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

/**
 * One AbortSignal for a request: aborts on the default timeout or when the caller's signal
 * aborts. Built by hand because AbortSignal.any/timeout are missing on older iOS Safari.
 */
function createRequestSignal(callerSignal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();

  if (callerSignal?.aborted) {
    controller.abort();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  return {
    signal: controller.signal,
    hasTimedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

type RefreshOutcome =
  | { kind: "refreshed"; access: string }
  | { kind: "invalid" }
  // Network failure, timeout, 5xx or 429: the session may still be valid, so keep the tokens.
  | { kind: "unavailable"; status: number };

let refreshPromise: Promise<RefreshOutcome> | null = null;

/** `POST /auth/refresh/`'s answer; `refresh` comes only from a server that rotates them. */
type RefreshAnswer = { access?: string; refresh?: string };

async function requestNewAccessToken(refreshToken: string): Promise<RefreshOutcome> {
  // Shared by every waiting request, so only the timeout (never one caller) may abort it.
  const request = createRequestSignal();
  let response: Response;
  let data: RefreshAnswer | null = null;
  try {
    response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: refreshToken }),
      signal: request.signal,
    });
    if (response.ok) {
      data = (await response.json().catch(() => null)) as RefreshAnswer | null;
    }
  } catch {
    return { kind: "unavailable", status: 0 };
  } finally {
    request.dispose();
  }

  if (response.status === 400 || response.status === 401) {
    clearToken();
    return { kind: "invalid" };
  }
  if (!response.ok) {
    return { kind: "unavailable", status: response.status };
  }

  if (!data?.access) {
    return { kind: "unavailable", status: response.status };
  }
  // A server that rotates refresh tokens (pass 6's sessions) sends a new one: keep it, or the
  // next refresh would offer a stale one (decision 4, AUTH-TWEAK-03).
  setTokens({ access: data.access, refresh: data.refresh });
  return { kind: "refreshed", access: data.access };
}

function refreshAccessToken(refreshToken: string) {
  if (!refreshPromise) {
    refreshPromise = requestNewAccessToken(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Swaps an expired access token for a new one through the shared single-flight refresh, for
 * callers that authenticate outside apiRequest (realtime channel auth). True when one was stored.
 */
export async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  const outcome = await refreshAccessToken(refreshToken);
  return outcome.kind === "refreshed";
}

/** Sends the request and reads the body, turning a timeout or abort into ApiError status 0. */
async function sendRequest(url: string, init: RequestInit, callerSignal?: AbortSignal) {
  const request = createRequestSignal(callerSignal);
  try {
    const response = await fetch(url, { ...init, signal: request.signal });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (request.signal.aborted) {
      const message = request.hasTimedOut() ? REQUEST_TIMEOUT_MESSAGE : REQUEST_ABORTED_MESSAGE;
      throw new ApiError(message, 0, null);
    }
    throw error;
  } finally {
    request.dispose();
  }
}

async function apiRequestInternal<T>(
  path: string,
  { method = "GET", body, token, headers: customHeaders, signal }: ApiRequestOptions = {},
  hasRetried = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  const resolvedToken = token === undefined ? getToken() : token;
  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`;
  }

  const { response, text } = await sendRequest(
    `${API_BASE_URL}${path}`,
    {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
    signal
  );

  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const refreshToken = getRefreshToken();
    if (response.status === 401 && !hasRetried && token !== null && refreshToken) {
      // Sent with a token another request has refreshed since: retry with the stored one. The
      // shared refresh may have finished before this 401 landed (BUG-158).
      const storedToken = getToken();
      const outcome: RefreshOutcome =
        storedToken && storedToken !== resolvedToken
          ? { kind: "refreshed", access: storedToken }
          : await refreshAccessToken(refreshToken);
      if (outcome.kind === "refreshed") {
        return apiRequestInternal(
          path,
          { method, body, token: outcome.access, headers: customHeaders, signal },
          true
        );
      }
      if (outcome.kind === "unavailable") {
        throw new ApiError(SERVER_UNAVAILABLE_MESSAGE, outcome.status, null);
      }
    }
    if (response.status === 401 && hasRetried && getToken() === resolvedToken) {
      // Even the freshly refreshed token is refused: the server has ended the session (the user
      // is gone or inactive). Sign out rather than refresh and retry on every request (BUG-141).
      clearToken();
    }

    let message: string | undefined;

    if (data && typeof data === "object" && "error" in data) {
      message = String((data as { error?: string }).error);
    } else if (data && typeof data === "object" && "detail" in data) {
      message = String((data as { detail?: string }).detail);
    } else if (data && typeof data === "object") {
      const values = Object.values(data as Record<string, unknown>);
      if (values.length > 0) {
        const firstValue = values[0];
        if (Array.isArray(firstValue)) {
          message = String(firstValue[0]);
        } else if (typeof firstValue === "string") {
          message = firstValue;
        }
      }
    }

    if (!message) {
      message = `Request failed (${response.status})`;
    }

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export async function apiRequest<T>(
  path: string,
  { method = "GET", body, token, headers: customHeaders, signal }: ApiRequestOptions = {}
): Promise<T> {
  try {
    return await apiRequestInternal<T>(path, {
      method,
      body,
      token,
      headers: customHeaders,
      signal,
    });
  } catch (error) {
    reportApiRefusal(error);
    throw error;
  }
}
