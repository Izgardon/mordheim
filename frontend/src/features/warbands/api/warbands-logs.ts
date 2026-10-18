import { apiRequest } from "../../../lib/api-client";
import { pagePath, type CursorPage } from "./cursor-pages";

import type { WarbandLog, WarbandLogCreatePayload } from "../types/warband-types";

/** A page of the log; the first also lists every feature the whole log has, for the filter. */
export type WarbandLogPage = CursorPage<WarbandLog> & { features?: string[] };

/** One page of the log, newest first, filtered on the server by `feature` (ECON-PERF-06). */
export function listWarbandLogPage(
  warbandId: number,
  page: { limit: number; cursor?: string | null; feature?: string }
) {
  const path = pagePath(`/warbands/${warbandId}/logs/`, page, { feature: page.feature });
  return apiRequest<WarbandLogPage>(path);
}

export function createWarbandLog(warbandId: number, payload: WarbandLogCreatePayload) {
  return apiRequest<WarbandLog>(`/warbands/${warbandId}/logs/`, {
    method: "POST",
    body: payload,
  });
}
