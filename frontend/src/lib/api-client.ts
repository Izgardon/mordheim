// config
import { API_BASE_URL } from "../config/env";

// utils
import { clearToken, getRefreshToken, getToken, setToken } from "../utils/storage";

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
};

export const SERVER_UNAVAILABLE_MESSAGE = "Can't reach the server right now. Please try again.";

/** True only when the server has definitively rejected the session (not for outages). */
export function isSessionExpiredError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

type RefreshOutcome =
  | { kind: "refreshed"; access: string }
  | { kind: "invalid" }
  // Network failure, 5xx or 429: the session may still be valid, so keep the tokens.
  | { kind: "unavailable"; status: number };

let refreshPromise: Promise<RefreshOutcome> | null = null;

async function requestNewAccessToken(refreshToken: string): Promise<RefreshOutcome> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });
  } catch {
    return { kind: "unavailable", status: 0 };
  }

  if (response.status === 400 || response.status === 401) {
    clearToken();
    return { kind: "invalid" };
  }
  if (!response.ok) {
    return { kind: "unavailable", status: response.status };
  }

  const data = (await response.json().catch(() => null)) as { access?: string } | null;
  if (!data?.access) {
    return { kind: "unavailable", status: response.status };
  }
  setToken(data.access);
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

async function apiRequestInternal<T>(
  path: string,
  { method = "GET", body, token, headers: customHeaders }: ApiRequestOptions = {},
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
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
      const outcome = await refreshAccessToken(refreshToken);
      if (outcome.kind === "refreshed") {
        return apiRequestInternal(
          path,
          { method, body, token: outcome.access, headers: customHeaders },
          true
        );
      }
      if (outcome.kind === "unavailable") {
        throw new ApiError(SERVER_UNAVAILABLE_MESSAGE, outcome.status, null);
      }
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
  { method = "GET", body, token, headers: customHeaders }: ApiRequestOptions = {}
): Promise<T> {
  return apiRequestInternal(path, { method, body, token, headers: customHeaders });
}
