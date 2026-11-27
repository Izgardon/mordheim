import type { QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

import { KEPT_MAX_AGE_MS, shouldKeepQuery } from "./kept-queries";
import { offlinePersister, type OfflinePersister } from "./persister";

/**
 * How the query cache is kept on the phone (docs/plans/offline.md, phase 1): the kept reads, for
 * a week, thrown away by a new build (`buster`), so a deploy never reads data saved in an older
 * shape. A restored read keeps its week in memory too. Writes are never kept: a paused one stays
 * in memory as before (queuing them is phase 3).
 */
export function offlinePersistOptions(
  queryClient: QueryClient,
  {
    persister = offlinePersister(),
    buildId = __APP_BUILD__,
  }: { persister?: OfflinePersister; buildId?: string } = {}
): Omit<PersistQueryClientOptions, "queryClient"> {
  const queryCache = queryClient.getQueryCache();
  return {
    persister,
    maxAge: KEPT_MAX_AGE_MS,
    buster: buildId,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => shouldKeepQuery(query, queryCache),
      shouldDehydrateMutation: () => false,
    },
    hydrateOptions: { defaultOptions: { queries: { gcTime: KEPT_MAX_AGE_MS } } },
  };
}

/** A phone may close the app once it is in the background: the waiting save is written first. */
export function flushWhenHidden(persister: OfflinePersister = offlinePersister()) {
  const onHide = () => {
    if (document.visibilityState === "hidden") void persister.flush();
  };
  const onPageHide = () => void persister.flush();
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);
  return () => {
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onPageHide);
  };
}
