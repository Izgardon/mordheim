import { apiRequest } from "../../../lib/api-client";

import type { WarbandLog, WarbandLogCreatePayload } from "../types/warband-types";
import { emitWarbandUpdate } from "./warbands-events";

export function listWarbandLogs(warbandId: number, feature?: string) {
  const params = new URLSearchParams();
  if (feature) {
    params.set("feature", feature);
  }
  const query = params.toString();
  const path = query
    ? `/warbands/${warbandId}/logs/?${query}`
    : `/warbands/${warbandId}/logs/`;
  return apiRequest<WarbandLog[]>(path);
}

export function createWarbandLog(
  warbandId: number,
  payload: WarbandLogCreatePayload
) {
  return apiRequest<WarbandLog>(`/warbands/${warbandId}/logs/`, {
    method: "POST",
    body: payload,
  }).then((data) => {
    emitWarbandUpdate(warbandId);
    return data;
  });
}
