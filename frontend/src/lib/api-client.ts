// config
import { API_BASE_URL } from "../config/env";

// utils
import { getToken } from "../utils/storage";

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

export async function apiRequest<T>(
  path: string,
  { method = "GET", body, token, headers: customHeaders }: ApiRequestOptions = {}
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




