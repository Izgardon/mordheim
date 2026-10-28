import type {
  PrebattleUnit,
  UnitItemEntry,
} from "@/features/battles/components/prebattle/prebattle-types";
import { battleCompanionSources } from "@/features/battles/utils/battle-companions";
import type { CompanionEntrySource } from "@/features/warbands/components/units/beasts/CompanionEntryMark";
import { companionEntries } from "@/features/warbands/utils/companions";
import {
  buildSpellCountMap,
  deduplicateSpells,
  getAdjustedSpellDc,
  getSpellDisplayName,
} from "@/features/warbands/utils/spell-display";

export type ActiveBlockEntry = {
  id: string;
  visibleId: number;
  label: string;
  type: "item" | "skill" | "spell" | "special" | "notes";
  dc?: string | number | null;
  item?: UnitItemEntry;
  remainingSingleUse?: number;
  /** A skill, special or spell a switched-on mount or pet brings (read-only, step 5). */
  companion?: CompanionEntrySource;
};

export type ActiveBlock = {
  id: string;
  title: string;
  entries: ActiveBlockEntry[];
};

/** The unit's items: its roster items, or its single-use items when the roster has none. */
export function activeItemSource(unit: PrebattleUnit): UnitItemEntry[] {
  if (unit.items?.length) {
    return unit.items;
  }
  return (unit.singleUseItems ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    count: item.quantity,
    singleUse: true,
  }));
}

/**
 * An active unit's detail tabs: items (with what is left of each single-use one), skills, spells
 * (deduplicated, with their DC), specials and notes, its companions' entries after its own
 * (`companions`: the mount's and pets' by default); empty tabs dropped.
 */
export function buildActiveBlocks(
  unit: PrebattleUnit,
  itemSource: UnitItemEntry[],
  getUsedSingleUseItemCount?: (itemId: number) => number,
  companions = battleCompanionSources(unit)
): ActiveBlock[] {
  const itemBlock: ActiveBlockEntry[] = itemSource.map((item) => {
    const used = getUsedSingleUseItemCount?.(item.id) ?? 0;
    const remainingSingleUse = item.singleUse ? Math.max(0, item.count - used) : 0;
    return {
      id: `item-${item.id}`,
      visibleId: item.id,
      label: item.count > 1 ? `${item.name} x ${item.count}` : item.name,
      type: "item",
      item,
      remainingSingleUse,
    };
  });

  const skillBlock: ActiveBlockEntry[] = (unit.skills ?? []).map((skill, index) => ({
    id: `skill-${skill.id}-${index}`,
    visibleId: skill.id,
    label: skill.name,
    type: "skill",
  }));

  const spells = unit.spells ?? [];
  const spellCounts = buildSpellCountMap(spells);
  const spellBlock: ActiveBlockEntry[] = deduplicateSpells(spells).map((spell, index) => ({
    id: `spell-${spell.id}-${index}`,
    visibleId: spell.id,
    label: getSpellDisplayName(spell, spellCounts),
    type: "spell",
    dc: getAdjustedSpellDc(spell.dc ?? null, spell, spellCounts),
  }));

  const specialBlock: ActiveBlockEntry[] = (unit.specials ?? []).map((special, index) => ({
    id: `special-${special.id}-${index}`,
    visibleId: special.id,
    label: special.name,
    type: "special",
  }));

  const notesBlock: ActiveBlockEntry[] = [
    { id: `notes-${unit.key}`, visibleId: 0, label: "", type: "notes" },
  ];

  return [
    { id: "items", title: "Items", entries: itemBlock },
    {
      id: "skills",
      title: "Skills",
      entries: [...skillBlock, ...companionEntries(companions, "skill")],
    },
    {
      id: "spells",
      title: "Spells",
      entries: [...spellBlock, ...companionEntries(companions, "spell")],
    },
    {
      id: "special",
      title: "Specials",
      entries: [...specialBlock, ...companionEntries(companions, "special")],
    },
    { id: "notes", title: "Notes", entries: notesBlock },
  ].filter((block) => block.entries.length > 0);
}
