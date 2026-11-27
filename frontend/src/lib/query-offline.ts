import type { FetchStatus } from "@tanstack/react-query";

/** What a list that never loaded says while the phone has no connection. */
export const NO_CONNECTION_LIST = "No connection: this list loads when you're back online.";

/**
 * A read waiting for the network with nothing to show. TanStack pauses a query once the browser
 * says it is offline, and a paused query isn't "loading" (`isLoading` is false), so a list hook
 * read as loaded and showed an empty list that looked real (docs/plans/offline.md). It resumes by
 * itself when the connection returns.
 */
export function isWaitingForNetwork(query: { fetchStatus: FetchStatus; data: unknown }) {
  return query.fetchStatus === "paused" && query.data === undefined;
}
