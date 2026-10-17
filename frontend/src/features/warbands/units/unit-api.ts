import { apiRequest } from "@/lib/api-client";

import type { NamedKillHistory } from "../types/warband-types";
import type { Unit, UnitKindKey, UnitPayload } from "../types/units";

/** URL segment per kind: `/warbands/<id>/<segment>/...`. */
export const UNIT_URL_SEGMENTS = {
  hero: "heroes",
  henchmen_group: "henchmen-groups",
  hired_sword: "hired-swords",
} as const satisfies Record<UnitKindKey, string>;

export type UnitApi<K extends UnitKindKey> = {
  list(warbandId: number): Promise<Unit<K>[]>;
  listDetails(warbandId: number): Promise<Unit<K>[]>;
  detail(warbandId: number, unitId: number): Promise<Unit<K>>;
  killHistory(warbandId: number, unitId: number): Promise<NamedKillHistory>;
  create(warbandId: number, payload: UnitPayload<K>): Promise<Unit<K>>;
  update(warbandId: number, unitId: number, payload: Partial<UnitPayload<K>>): Promise<Unit<K>>;
  remove(warbandId: number, unitId: number): Promise<void>;
  levelUp(warbandId: number, unitId: number, payload: Record<string, unknown>): Promise<Unit<K>>;
};

function createUnitApi<K extends UnitKindKey>(kind: K): UnitApi<K> {
  const base = (warbandId: number) => `/warbands/${warbandId}/${UNIT_URL_SEGMENTS[kind]}/`;
  const one = (warbandId: number, unitId: number) => `${base(warbandId)}${unitId}/`;

  return {
    list: (warbandId) => apiRequest<Unit<K>[]>(base(warbandId)),
    listDetails: (warbandId) => apiRequest<Unit<K>[]>(`${base(warbandId)}detail/`),
    detail: (warbandId, unitId) => apiRequest<Unit<K>>(one(warbandId, unitId)),
    killHistory: (warbandId, unitId) =>
      apiRequest<NamedKillHistory>(`${one(warbandId, unitId)}kill-history/`),
    create: (warbandId, payload) =>
      apiRequest<Unit<K>>(base(warbandId), { method: "POST", body: payload }),
    update: (warbandId, unitId, payload) =>
      apiRequest<Unit<K>>(one(warbandId, unitId), { method: "PATCH", body: payload }),
    remove: (warbandId, unitId) => apiRequest<void>(one(warbandId, unitId), { method: "DELETE" }),
    levelUp: (warbandId, unitId, payload) =>
      apiRequest<Unit<K>>(`${one(warbandId, unitId)}level-up/`, {
        method: "POST",
        body: { payload },
      }),
  };
}

const UNIT_APIS: { [K in UnitKindKey]: UnitApi<K> } = {
  hero: createUnitApi("hero"),
  henchmen_group: createUnitApi("henchmen_group"),
  hired_sword: createUnitApi("hired_sword"),
};

/** The roster endpoints of one unit kind (same URLs, bodies and status codes as before). */
export function unitApi<K extends UnitKindKey>(kind: K): UnitApi<K> {
  return UNIT_APIS[kind];
}
