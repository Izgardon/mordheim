import type { StatKey as StatField } from "@/features/catalogue/utils/statblock";
import type { Spell } from "@/features/spells/types/spell-types";

import { STAT_NAME_MAP } from "../../../utils/levelup-utils";

/** A stat an advance raises, as the level-up endpoint names it. */
export type StatCode = "M" | "WS" | "BS" | "S" | "T" | "W" | "I" | "A" | "Ld";

/** What a row of the advance table gives. */
export type AdvanceOutcome =
  | { kind: "skill" }
  | { kind: "stat"; stat: StatCode }
  | { kind: "choose"; stats: [StatCode, StatCode] }
  | { kind: "d6"; low: StatCode; high: StatCode }
  | { kind: "talent" };

export type AdvanceRow = { from: number; to: number; label: string; outcome: AdvanceOutcome };

const d6 = (low: StatCode, high: StatCode): AdvanceRow["outcome"] => ({ kind: "d6", low, high });
const plus = (stat: StatCode) => `+1 ${STAT_NAME_MAP[stat]}`;

/** The hero advance table (2D6), which hired swords use too (decision 8). */
export const HERO_TABLE: AdvanceRow[] = [
  { from: 2, to: 5, label: "New skill", outcome: { kind: "skill" } },
  { from: 6, to: 6, label: `D6: 1–3 ${plus("S")}, 4–6 ${plus("A")}`, outcome: d6("S", "A") },
  {
    from: 7,
    to: 7,
    label: `${plus("WS")} or ${plus("BS")}`,
    outcome: { kind: "choose", stats: ["WS", "BS"] },
  },
  { from: 8, to: 8, label: `D6: 1–3 ${plus("I")}, 4–6 ${plus("Ld")}`, outcome: d6("I", "Ld") },
  { from: 9, to: 9, label: `D6: 1–3 ${plus("W")}, 4–6 ${plus("T")}`, outcome: d6("W", "T") },
  { from: 10, to: 12, label: "New skill", outcome: { kind: "skill" } },
];

/** The henchmen advance table (2D6). */
export const HENCHMEN_TABLE: AdvanceRow[] = [
  { from: 2, to: 4, label: plus("I"), outcome: { kind: "stat", stat: "I" } },
  { from: 5, to: 5, label: plus("S"), outcome: { kind: "stat", stat: "S" } },
  {
    from: 6,
    to: 7,
    label: `${plus("WS")} or ${plus("BS")}`,
    outcome: { kind: "choose", stats: ["WS", "BS"] },
  },
  { from: 8, to: 8, label: plus("A"), outcome: { kind: "stat", stat: "A" } },
  { from: 9, to: 9, label: plus("Ld"), outcome: { kind: "stat", stat: "Ld" } },
  { from: 10, to: 12, label: "The lad's got talent", outcome: { kind: "talent" } },
];

export const rowFor = (table: AdvanceRow[], roll: number | null) =>
  roll === null ? undefined : table.find((row) => roll >= row.from && roll <= row.to);

/** The stat a D6 follow-up lands on: 1–3 the first, 4–6 the second. */
export const d6Stat = (outcome: { low: StatCode; high: StatCode }, roll: number) =>
  roll <= 3 ? outcome.low : outcome.high;

export const UNIT_FIELD: Record<StatCode, StatField> = {
  M: "movement",
  WS: "weapon_skill",
  BS: "ballistic_skill",
  S: "strength",
  T: "toughness",
  W: "wounds",
  I: "initiative",
  A: "attacks",
  Ld: "leadership",
};

/** A stat's value on a unit or the cap on a race (the same field names), or null when it has none. */
export const statOf = (source: object | null | undefined, stat: StatCode): number | null => {
  const value = source ? (source as Record<string, unknown>)[UNIT_FIELD[stat]] : null;
  return typeof value === "number" ? value : null;
};

/** "S 3 → 4 (max 4)", and whether it goes past his race's maximum (a warning: it still applies). */
export function statChange(stat: StatCode, current: number | null, max: number | null) {
  const from = current ?? 0;
  const capped = max === null ? "" : ` (max ${max})`;
  return {
    text: `${stat} ${from} → ${from + 1}${capped}`,
    overMax: max !== null && from + 1 > max,
  };
}

const bookDc = (dc: Spell["dc"]) => (dc === null || dc === undefined ? "" : String(dc).trim());
const asNumber = (dc: string) => (/^\d+$/.test(dc) ? Number(dc) : null);

/** A spell's difficulty for this unit: the book's, lowered by what he rolled again ("7 → 6"). */
export function spellDifficulty(dc: Spell["dc"], change = 0) {
  const book = bookDc(dc);
  const value = asNumber(book);
  return value !== null && change ? `${value} → ${value + change}` : book;
}

/**
 * What a D6 on a lore gives him: the spell on that roll (a spell with no roll is never landed on)
 * and what it gives (`spellResult`), or null when no spell has the roll.
 */
export function spellRollResult(lore: Spell[], known: Spell[], roll: number) {
  const spell = lore.find((entry) => entry.roll === roll);
  return spell ? spellResult(spell, known) : null;
}

/**
 * What a spell gives him: the spell and its difficulty, or, for one he knows, that it gets 1 easier
 * for him ("7 → 6"; a spell cast automatically stays as it is).
 */
export function spellResult(spell: Spell, known: Spell[]) {
  const fold = (text?: string | null) => (text ?? "").trim().toLowerCase();
  const same = known.find(
    (entry) =>
      entry.id === spell.id ||
      (fold(entry.name) === fold(spell.name) && fold(entry.type) === fold(spell.type))
  );
  if (!same) return { spell, known: false, difficulty: bookDc(spell.dc) };
  const now = asNumber(bookDc(same.dc ?? spell.dc));
  const current = now === null ? null : now + (same.dc_change ?? 0);
  const difficulty = current === null ? bookDc(same.dc ?? spell.dc) : `${current} → ${current - 1}`;
  return { spell, known: true, difficulty };
}
