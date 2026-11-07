import {
  draftOf,
  everyone,
  linesPayload,
  type WhoCanDraft,
} from "@/features/catalogue/utils/who-can-draft";

import type { AvailabilityPayload, ItemAvailability } from "../types/item-types";

/** One price row as the forms edit it (the item form, a beast's shop prices). */
export type PriceRowDraft = {
  key: number;
  label: string;
  cost: string;
  dice: string;
  multiplier: string;
  costNote: string;
  /** Blank: Common. */
  rarity: string;
  note: string;
  who: WhoCanDraft;
  /**
   * The label and cost note a row held when it was read, which the form keeps showing (William,
   * 7 Nov 2026: "we only need the Note when buying for custom items going forward and leave
   * current data as is"); a new row offers neither.
   */
  holds: { label: boolean; costNote: boolean };
};

export type PriceRowField = Exclude<keyof PriceRowDraft, "key" | "who" | "holds">;

let nextKey = 1;

export const blankPriceRow = (): PriceRowDraft => ({
  key: nextKey++,
  label: "",
  cost: "",
  dice: "",
  multiplier: "",
  costNote: "",
  rarity: "",
  note: "",
  who: everyone(),
  holds: { label: false, costNote: false },
});

const text = (value: number | null | undefined) => (value == null ? "" : String(value));

export const priceRowsOf = (rows: ItemAvailability[] | null | undefined): PriceRowDraft[] =>
  (rows ?? []).map((row) => ({
    key: nextKey++,
    label: row.label ?? "",
    cost: text(row.cost),
    dice: text(row.dice),
    multiplier: text(row.dice_multiplier),
    costNote: row.cost_note ?? "",
    rarity: text(row.rarity),
    note: row.note ?? "",
    who: draftOf(row),
    holds: { label: Boolean(row.label?.trim()), costNote: Boolean(row.cost_note?.trim()) },
  }));

const numberOrNull = (value: string) => (value.trim() ? Number(value) : null);

export const priceRowsPayload = (rows: PriceRowDraft[]): AvailabilityPayload[] =>
  rows.map((row) => ({
    label: row.label.trim(),
    cost: numberOrNull(row.cost),
    dice: numberOrNull(row.dice),
    dice_multiplier: row.dice.trim() ? numberOrNull(row.multiplier) : null,
    cost_note: row.costNote.trim(),
    rarity: numberOrNull(row.rarity),
    for_everyone: row.who.forEveryone,
    note: row.note.trim(),
    warbands: linesPayload(row.who),
  }));

export const PRICE_HINT = "Needs a price of 0 or more.";
/** A row that holds a cost note may stand on it alone. */
export const PRICE_OR_NOTE_HINT = "Needs a price of 0 or more, or a cost note.";
export const RARITY_HINT = "Blank for Common, else a rarity from 2 to 20.";
export const DICE_HINT = "Blank, or 1 to 20 dice.";
export const MULTIPLIER_HINT = "Blank, or 1 or more.";

const whole = (value: string, min: number, max: number) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
};

/** A row is blank when nothing in it was filled (a folded-away shop price is left out). */
export const isBlankRow = (row: PriceRowDraft) =>
  ![row.label, row.cost, row.dice, row.multiplier, row.costNote, row.rarity, row.note].some(
    (value) => value.trim()
  ) &&
  row.who.forEveryone &&
  !row.who.lines.length;

/**
 * What stops a save before it is sent (the server's own limits), under each field as the server's
 * refusals are, at `prefix.N.field` ("availabilities.0.cost").
 */
export function priceRowProblems(rows: PriceRowDraft[], prefix: string) {
  const fields: Record<string, string> = {};
  rows.forEach((row, index) => {
    const at = `${prefix}.${index}`;
    if (row.cost.trim() ? !whole(row.cost, 0, 2_147_483_647) : !row.costNote.trim()) {
      fields[`${at}.cost`] = row.holds.costNote ? PRICE_OR_NOTE_HINT : PRICE_HINT;
    }
    if (row.rarity.trim() && !whole(row.rarity, 2, 20)) fields[`${at}.rarity`] = RARITY_HINT;
    if (row.dice.trim() && !whole(row.dice, 1, 20)) fields[`${at}.dice`] = DICE_HINT;
    if (row.dice.trim() && row.multiplier.trim() && !whole(row.multiplier, 1, 1000)) {
      fields[`${at}.dice_multiplier`] = MULTIPLIER_HINT;
    }
  });
  return fields;
}
