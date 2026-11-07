import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { Spell } from "./types/spell-types";

/** A spell's lore as the pages name it: its type, underscores as spaces. */
export const loreOf = (spell: Spell) => (spell.type ?? "").replace(/_/g, " ") || "No lore";

/** A spell's difficulty as its cell shows it: "7", "Auto", or "" for none. */
export const difficultyOf = (spell: Spell) =>
  spell.dc === null || spell.dc === undefined ? "" : String(spell.dc).trim();

const isNumber = (dc: string) => /^\d+$/.test(dc);

/** "Difficulty 7", or "Auto" for a spell that needs no roll. */
export function difficultyLabel(spell: Spell) {
  const dc = difficultyOf(spell);
  return isNumber(dc) ? `Difficulty ${dc}` : dc;
}

/** The DOM key of a lore's row ("lore-lesser-magic"), apart from the spells' ids. */
export const loreRowId = (name: string) =>
  `lore-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;

export type SpellLore = {
  name: string;
  /** The spells it shows, by roll (none last), then name: all, or while searching the matches. */
  spells: Spell[];
  /** How many of its spells match the search (all of them with none). */
  matches: number;
  total: number;
};

const byRoll = (a: Spell, b: Spell) =>
  (a.roll ?? 99) - (b.roll ?? 99) || a.name.localeCompare(b.name);

/**
 * The spells by lore, the lores by name and each one's spells as its D6 table, by roll (a spell
 * with no roll last). With a search, a lore keeps only the spells whose name, lore or rules match,
 * and a lore with none is left out; the open spell always stays.
 */
export function spellLores(spells: Spell[], query: string, openId: string | null): SpellLore[] {
  const byLore = new Map<string, Spell[]>();
  for (const spell of spells) {
    const name = loreOf(spell);
    byLore.set(name, [...(byLore.get(name) ?? []), spell]);
  }
  return [...byLore.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, lore]) => {
      const sorted = [...lore].sort(byRoll);
      const matching = sorted.filter((spell) =>
        matchesSearchQuery(query, spell.name, name, spell.description)
      );
      return {
        name,
        spells: sorted.filter((spell) => matching.includes(spell) || String(spell.id) === openId),
        matches: matching.length,
        total: sorted.length,
      };
    })
    .filter((lore) => lore.spells.length > 0);
}
