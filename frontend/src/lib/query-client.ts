import { QueryClient } from "@tanstack/react-query";

// other
import { ApiError } from "./api-client";

export const DEFAULT_STALE_TIME_MS = 30_000;
export const DEFAULT_GC_TIME_MS = 5 * 60_000;
const MAX_QUERY_RETRIES = 1;

/** Network failures, timeouts and 5xx responses are worth one retry; 4xx answers are final. */
export function isRetryableError(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status >= 500;
  }
  // fetch rejects with a TypeError when the request never reached the server.
  return error instanceof TypeError;
}

export function shouldRetryQuery(failureCount: number, error: unknown) {
  return failureCount < MAX_QUERY_RETRIES && isRetryableError(error);
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        gcTime: DEFAULT_GC_TIME_MS,
        refetchOnWindowFocus: true,
        retry: shouldRetryQuery,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
