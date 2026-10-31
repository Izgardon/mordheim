import type { AccessLine, ItemAvailability } from "../types/item-types";

/** "Common", or "Rare 9": a price row's rarity (null is Common). */
export const rarityLabel = (rarity: number | null | undefined) =>
  rarity == null ? "Common" : `Rare ${rarity}`;

export const isCommon = (rarity: number | null | undefined) => rarity == null;

type Price = Pick<ItemAvailability, "cost" | "dice" | "dice_multiplier" | "cost_note">;

/** "2D6", "D6×25": the dice a price adds ("" without any). */
export function diceLabel(row: Pick<ItemAvailability, "dice" | "dice_multiplier">) {
  if (!row.dice) return "";
  const dice = `${row.dice === 1 ? "" : row.dice}D6`;
  return row.dice_multiplier ? `${dice}×${row.dice_multiplier}` : dice;
}

/** A cost note short enough to stand beside the price in a list ("per pair", "1st free"). */
const SHORT_NOTE = 16;

/** A priced row's cost note too long for a list ("Gold is spent even on..."): the card shows it. */
export const longCostNote = (row: Price) =>
  row.cost != null && (row.cost_note ?? "").length > SHORT_NOTE ? row.cost_note : "";

/**
 * A price as the store and the cards show it: "15 gc", "25 + 2D6 gc", "200 + D6×25 gc", with a
 * short cost note ("per pair"); a row with no cost shows its note ("4 x Price"), else "-".
 */
export function priceLabel(row: Price | null | undefined) {
  if (!row) return "-";
  const dice = diceLabel(row);
  const base = row.cost == null ? null : dice ? `${row.cost} + ${dice} gc` : `${row.cost} gc`;
  const note = longCostNote(row) ? "" : row.cost_note;
  const parts = [base ?? (dice ? `${dice} gc` : ""), note].filter(Boolean);
  return parts.join(" · ") || "-";
}

/** What a rolled price comes to: the cost plus the pips, each worth the multiplier (or 1). */
export const rolledPrice = (row: Price, pips: number) =>
  (row.cost ?? 0) + pips * (row.dice_multiplier ?? 1);

const names = (lines: AccessLine[]) => lines.map((line) => line.name).join(", ");

/**
 * Who may buy a price row (or hire, or learn): "For everyone", "Everyone except Dark Elves",
 * "For Skaven, Lizardmen", or "For Humans, not Witch Hunters".
 */
export function whoLine(list: { for_everyone: boolean; warbands: AccessLine[] }) {
  const included = list.warbands.filter((line) => !line.excluded);
  const excluded = list.warbands.filter((line) => line.excluded);
  if (list.for_everyone) {
    return excluded.length ? `Everyone except ${names(excluded)}` : "For everyone";
  }
  if (!included.length) return "Not usually available to anyone";
  return excluded.length
    ? `For ${names(included)}, not ${names(excluded)}`
    : `For ${names(included)}`;
}
