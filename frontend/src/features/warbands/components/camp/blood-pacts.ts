import type { WarbandHireling } from "../../types/warband-types";
import type { OpenCamp } from "./camp-types";

/** A 12 swears the pact; anything else does not (the server's `PACT_ROLL`). */
export const PACT_ROLL = 12;

/**
 * Mutiny in Marienburg's Blood Pact, in our own words, with every number the book gives. It carries
 * the parts the app does not automate (equipping from the Heroes' list, and taking command when the
 * leader falls) and the warriors who never swear one, which our catalogue does not classify, so the
 * player reads them here (edge cases are rule text, William, 4 Nov 2026).
 */
export const BLOOD_PACT_RULE = [
  "Roll 2D6 for each hired sword in the post-game, after his upkeep is paid, adding 1 for each skill or characteristic increase he has gained. On a 12 he swears an oath in blood and forms a blood pact with the warband.",
  "Assassins, Thieves, Merchants, Fences and Slavers never form a pact.",
  "A hired sword in a pact still counts as a hired sword but pays no upkeep, and may be equipped from the warband's Heroes' equipment list.",
  "If the leader is slain and the pact-sworn warrior has the next highest Leadership, he takes command: he gains the Leader ability (keeping his own skill list) and counts as a hero. If several are eligible, the one with the most experience takes over; roll a D6 on a tie.",
];

export type PactLine = {
  id: number;
  name: string;
  /** +1 per skill or characteristic increase he has gained (the server's count). */
  bonus: number;
};

/**
 * The hired swords the post-game offers a roll for: those the server says could still swear one
 * (a living hired sword without a pact; a dramatis persona never does).
 */
export function pactLines(camp: OpenCamp): PactLine[] {
  return camp.hirelings.filter(canPact).map((sword) => ({
    id: sword.id,
    name: sword.name?.trim() || sword.unit_type?.trim() || `Hired Sword ${sword.id}`,
    bonus: sword.blood_pact_bonus ?? 0,
  }));
}

const canPact = (sword: WarbandHireling) => Boolean(sword.can_blood_pact);

/** The roll as it stands: the dice with the bonus, or null until every die is in. */
export function pactTotal(faces: (number | null)[], bonus: number) {
  if (!faces.length || faces.some((face) => face === null)) return null;
  return faces.reduce<number>((sum, face) => sum + (face ?? 0), 0) + bonus;
}
