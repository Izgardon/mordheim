import type { Fee } from "@/features/hirelings/fees";
import { apiRequest } from "@/lib/api-client";

import type { WarbandHireling } from "../types/warband-types";

/** Which catalogue a hire copies from, or `custom`: one typed by hand. */
export type HireSource = "hired_sword" | "dramatis_persona" | "custom";

/**
 * Something about a hire worth knowing, never a refusal: a second copy of the same dramatis
 * persona (`dramatis_persona_already_hired`), an entry archived or removed for the campaign
 * (`archived_entry`), a fee in his rules (`fee_special`), a hero's place when the heroes are full
 * (`hero_place_taken`), dice not rolled (`fee_not_rolled`), a resource paid short or by nothing
 * (`resource_short`, `resource_unpaid`).
 */
export type HireWarning = { code: string; message: string; id?: number; source?: HireSource };

/** The new hireling, as its detail reads, with the hire's warnings. */
export type HireAnswer = WarbandHireling & { warnings?: HireWarning[] };

/** A resource line the hire pays: from the counter named (null: not paid). */
export type HirePaymentLine = { resource: string; amount: number; resource_id: number | null };

export type HireBody = {
  source: HireSource;
  /** The catalogue entry (not for a custom hire). */
  id?: number;
  name?: string;
  /** A custom hire's type and upkeep. */
  unit_type?: string;
  upkeep_fee?: Fee;
  /** What is paid: the gold (the fee's gold and the roll when left out) and the resources. */
  price?: number;
  dice_roll?: number | null;
  resources?: HirePaymentLine[];
  /** One who takes a hero's place, at the heroes' cap: the hero who goes. */
  dismiss_hero_id?: number | null;
};

/**
 * `POST warbands/<id>/hirelings/hire/`: the server copies a hired sword or dramatis persona of the
 * campaign's catalogue onto the warband (profile, kit with its quantities, both fees, a dramatis
 * persona's terms), or makes one typed by hand, charges what the body pays (the gold, and each
 * resource from its counter, never below 0) and logs the hire. A hired sword at the cap is refused
 * (400 `hired_sword_cap_reached`); a dramatis persona or one in a hero's place never is.
 */
export function hireWarbandHireling(warbandId: number, body: HireBody) {
  return apiRequest<HireAnswer>(`/warbands/${warbandId}/hirelings/hire/`, {
    method: "POST",
    body,
  });
}
