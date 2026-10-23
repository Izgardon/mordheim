import { isPendingByName } from "../heroes/utils/pending-entries";
import { groupItemsById } from "../../utils/warband-utils";
import {
  companionAbilities,
  companionSources,
  isSwitchedOn,
  type CompanionSource,
} from "../../utils/companions";
import {
  buildSpellCountMap,
  deduplicateSpells,
  getAdjustedSpellDc,
  getSpellDisplayName,
} from "../../utils/spell-display";

import type { BeastKind } from "@/features/bestiary/bestiary-kinds";
import type { Item } from "@/features/items/types/item-types";
import type { Unit, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

export type LoadoutEntryType = "item" | "skill" | "spell" | "special" | "roster";

/**
 * An Animal item's row: its beast's kind, whether its copies are switched on for the unit, and
 * the copy the button acts on (a spare to switch on, the newest ridden one to switch off).
 */
export type LoadoutBeast = { kind: BeastKind; on: boolean; rowId: number | null };

/** The switched-on mount or pet a skill, special or spell comes with (read-only, step 5). */
export type LoadoutCompanion = { kind: "mount" | "pet"; name: string };

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
  beast?: LoadoutBeast;
  companion?: LoadoutCompanion;
};

type AbilityType = "skill" | "special" | "spell";
const ABILITY_KEYS = { skill: "skills", special: "specials", spell: "spells" } as const;

/**
 * The companions' skills (specials, spells) as entries after the unit's own, each marked with its
 * beast: never pending and never part of the unit's own lists or a PATCH.
 */
export function companionEntries(sources: CompanionSource[], type: AbilityType): LoadoutEntry[] {
  return companionAbilities(sources, ABILITY_KEYS[type]).map(({ ability, source }, index) => ({
    id: `companion-${type}-${source.kind}-${source.itemId}-${ability.id}-${index}`,
    visibleId: ability.id,
    label: ability.name,
    type,
    ...(type === "spell" ? { dc: ability.dc ?? null } : {}),
    companion: { kind: source.kind, name: source.name },
  }));
}

type ItemRow = { key: string; item: Item; rows: Item[] };

/**
 * A unit's copies as its item rows: one per item, except a mount or pet whose switched-on copies
 * get their own row (`item-<id>-on`), so each row's switch has one state.
 */
export function itemRows(items: Item[]): ItemRow[] {
  const rows = new Map<string, ItemRow>();
  for (const item of items) {
    const key = isSwitchedOn(item) ? `item-${item.id}-on` : `item-${item.id}`;
    const row = rows.get(key);
    if (row) row.rows.push(item);
    else rows.set(key, { key, item, rows: [item] });
  }
  return Array.from(rows.values());
}

const beastOf = (kind: BeastKind, rows: Item[]): LoadoutBeast => {
  const on = isSwitchedOn(rows[0]);
  const copy = on ? rows[rows.length - 1] : rows[0];
  return { kind, on, rowId: copy?.row_id ?? null };
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

  const copiesOf = new Map<number, number>();
  for (const { item, count } of groupItemsById(unit.items ?? [])) copiesOf.set(item.id, count);
  const items: LoadoutEntry[] = itemRows(unit.items ?? []).map(({ key, item, rows }) => ({
    id: key,
    visibleId: item.id,
    label: rows.length >= 2 ? `${item.name} x ${rows.length}` : item.name,
    type: "item",
    // A split item's copies divide across the members together (its ridden and spare rows).
    ...(hasMembers ? { count: copiesOf.get(item.id) ?? rows.length } : {}),
    ...(item.beast_kind ? { beast: beastOf(item.beast_kind, rows) } : {}),
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
  const companions = companionSources(unit);
  const companionSpells = companionEntries(companions, "spell");
  const spellBlock = [...(hasSpells ? spellEntries : []), ...companionSpells];

  return [
    ...(hasMembers
      ? [{ id: "roster", title: `Roster ${members.length}/${maxSize}`, entries: roster }]
      : []),
    { id: "items", title: "Items", entries: items },
    {
      id: "skills",
      title: "Skills",
      entries: [...named("skill", unit.skills ?? []), ...companionEntries(companions, "skill")],
    },
    // A kind without spells still lists its companions' (a group riding a mount that casts).
    ...(hasSpells || companionSpells.length
      ? [{ id: "spells", title: "Spells", entries: spellBlock }]
      : []),
    {
      id: "special",
      title: "Specials",
      entries: [
        ...named("special", unit.specials ?? []),
        ...companionEntries(companions, "special"),
      ],
    },
  ].filter((block) => block.entries.length > 0);
}
