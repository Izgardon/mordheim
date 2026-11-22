import { formatXp } from "../roster/unit-view";
import type { RatingRow, WarbandRecordBattle } from "../../types/warband-types";

/** How many ledger rows the Gold window lists (William, 22 Nov 2026: "last few trades"). */
export const RECENT_TRADES = 10;

const SECTIONS: { kind: RatingRow["kind"]; label: string }[] = [
  { kind: "hero", label: "Heroes" },
  { kind: "henchmen_group", label: "Henchmen" },
  { kind: "hired_sword", label: "Hired swords" },
  { kind: "dramatis_persona", label: "Dramatis personae" },
];

/** The server's rows sectioned as the roster is, each section with rows only. */
export function ratingSections(rows: RatingRow[]) {
  return SECTIONS.map((section) => ({
    ...section,
    rows: rows.filter((row) => row.kind === section.kind),
  })).filter((section) => section.rows.length > 0);
}

/**
 * How a unit's part of the rating adds up, from the server's figures: "5 + 12½ XP",
 * "2 × (5 + 2 XP) + 10 mounts", "18 + 4 XP".
 */
export function ratingSum(row: RatingRow) {
  const each = row.xp ? `${row.per_model} + ${formatXp(row.xp)} XP` : String(row.per_model);
  const models = row.models === 1 ? each : `${row.models} × (${each})`;
  if (!row.mounts) return models;
  return `${models} + ${row.mounts} ${row.models === 1 ? "mount" : "mounts"}`;
}

/** "Level 3"; a henchmen group's with its models: "3 models · Level 1". */
export function unitLevelLine(row: RatingRow) {
  const level = `Level ${row.level}`;
  if (row.kind !== "henchmen_group") return level;
  return `${row.models} ${row.models === 1 ? "model" : "models"} · ${level}`;
}

export const RESULT_LABEL: Record<WarbandRecordBattle["result"], string> = {
  won: "Won",
  lost: "Lost",
  no_winner: "No winner",
};

/** "Rats and Beasts": the warbands it fought. */
export function opponentsLine(battle: WarbandRecordBattle) {
  const names = battle.opponents.map((opponent) => opponent.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
