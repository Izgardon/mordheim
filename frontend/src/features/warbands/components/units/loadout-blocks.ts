import { isPendingByName } from "../heroes/utils/pending-entries";
import { groupItemsById } from "../../utils/warband-utils";
import {
  buildSpellCountMap,
  deduplicateSpells,
  getAdjustedSpellDc,
  getSpellDisplayName,
} from "../../utils/spell-display";

import type { Unit, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

export type LoadoutEntryType = "item" | "skill" | "spell" | "special" | "roster";

export type LoadoutEntry = {
  id: string;
  visibleId: number;
  label: string;
  type: LoadoutEntryType;
  dc?: string | number | null;
  pending?: boolean;
  dead?: boolean;
  kills?: number;
  count?: number;
};

export type LoadoutBlock = {
  id: string;
  title: string;
  entries: LoadoutEntry[];
};

type NamedEntry = { id: number; name: string };

/**
 * The card's loadout tabs, empty blocks dropped. Henchmen add a Roster block first, have no
 * Spells block and no pending entries; heroes and hired swords mark "New Skill/Spell/Special"
 * placeholders as pending and show spells deduplicated with their DC.
 */
export function buildLoadoutBlocks<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  unit: Unit<K>,
  spellLookup?: Record<number, { dc?: string | number | null }>
): LoadoutBlock[] {
  const { hasMembers, hasSpells, hasPendingAdvances } = kind.flags;
  const pending = (type: "skill" | "spell" | "special", name: string) =>
    hasPendingAdvances ? { pending: isPendingByName(type, name) } : {};
  const named = (type: "skill" | "special", entries: NamedEntry[]): LoadoutEntry[] =>
    entries.map((entry, index) => ({
      id: `${type}-${entry.id}-${index}`,
      visibleId: entry.id,
      label: entry.name,
      type,
      ...pending(type, entry.name),
    }));

  const items: LoadoutEntry[] = groupItemsById(unit.items ?? []).map(({ item, count }) => ({
    id: `item-${item.id}`,
    visibleId: item.id,
    label: count >= 2 ? `${item.name} x ${count}` : item.name,
    type: "item",
    ...(hasMembers ? { count } : {}),
  }));

  const spells = "spells" in unit ? (unit.spells ?? []) : [];
  const spellCounts = buildSpellCountMap(spells);
  const spellEntries: LoadoutEntry[] = deduplicateSpells(spells).map((spell, index) => ({
    id: `spell-${spell.id}-${index}`,
    visibleId: spell.id,
    label: getSpellDisplayName(spell, spellCounts),
    type: "spell",
    dc: getAdjustedSpellDc(spell.dc ?? spellLookup?.[spell.id]?.dc ?? null, spell, spellCounts),
    ...pending("spell", spell.name),
  }));

  const members = "henchmen" in unit ? (unit.henchmen ?? []) : [];
  const roster: LoadoutEntry[] = members
    .filter((henchman) => henchman.name?.trim())
    .map((henchman) => ({
      id: `roster-${henchman.id}`,
      visibleId: henchman.id,
      label: henchman.name,
      type: "roster",
      dead: henchman.dead,
      kills: henchman.kills ?? 0,
    }));
  const maxSize = "max_size" in unit ? (unit.max_size ?? 5) : 5;

  return [
    ...(hasMembers
      ? [{ id: "roster", title: `Roster ${members.length}/${maxSize}`, entries: roster }]
      : []),
    { id: "items", title: "Items", entries: items },
    { id: "skills", title: "Skills", entries: named("skill", unit.skills ?? []) },
    ...(hasSpells ? [{ id: "spells", title: "Spells", entries: spellEntries }] : []),
    { id: "special", title: "Specials", entries: named("special", unit.specials ?? []) },
  ].filter((block) => block.entries.length > 0);
}
