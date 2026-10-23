import { apiRequest } from "@/lib/api-client";

import { unitApi } from "../units/unit-api";

import type { WarbandHireling } from "../types/warband-types";

const hirelings = unitApi("hireling");

export const listWarbandHirelings = hirelings.list;
export const listWarbandHirelingDetails = hirelings.listDetails;
export const getWarbandHirelingDetail = hirelings.detail;
export const getWarbandHirelingKillHistory = hirelings.killHistory;
export const createWarbandHireling = hirelings.create;
export const updateWarbandHireling = hirelings.update;
export const deleteWarbandHireling = hirelings.remove;
export const levelUpWarbandHireling = hirelings.levelUp;
export const batchWarbandHirelings = hirelings.batch;

/** Which catalogue a hire copies from. */
export type HireSource = "hired_sword" | "dramatis_persona";

/**
 * Something about a hire worth knowing, never a refusal: a second copy of the same dramatis
 * persona (`dramatis_persona_already_hired`), or an entry archived or removed for the campaign
 * (`archived_entry`).
 */
export type HireWarning = { code: string; message: string; id?: number; source?: HireSource };

/** The new hireling, as its detail reads, with the hire's warnings. */
export type HireAnswer = WarbandHireling & { warnings?: HireWarning[] };

/**
 * `POST warbands/<id>/hirelings/hire/`: the server copies a hired sword or dramatis persona of the
 * campaign's catalogue onto the warband (profile, kit with its quantities, both cost formulas, a
 * dramatis persona's terms), charges the fee in gold when it is gold, and logs the hire. A hired
 * sword at the cap is refused (400 `hired_sword_cap_reached`); a dramatis persona never is.
 */
export function hireWarbandHireling(
  warbandId: number,
  body: { source: HireSource; id: number; name?: string }
) {
  return apiRequest<HireAnswer>(`/warbands/${warbandId}/hirelings/hire/`, {
    method: "POST",
    body,
  });
}
