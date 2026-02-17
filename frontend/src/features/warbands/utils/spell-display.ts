import type { Spell } from "@/features/spells/types/spell-types";
import { isPendingByName } from "../components/heroes/utils/pending-entries";

const PENDING_TYPE = "Pending";

type SpellCountMap = Record<number, number>;

const isPendingSpell = (spell: Spell) =>
  spell.type === PENDING_TYPE || isPendingByName("spell", spell.name);

const coerceNumeric = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const buildSpellCountMap = (spells: Spell[]): SpellCountMap =>
  spells.reduce<SpellCountMap>((acc, spell) => {
    if (isPendingSpell(spell)) return acc;
    acc[spell.id] = (acc[spell.id] ?? 0) + 1;
    return acc;
  }, {});

export const getSpellDisplayName = (spell: Spell, counts: SpellCountMap) => {
  if (isPendingSpell(spell)) return spell.name;
  const count = counts[spell.id] ?? 0;
  return count >= 2 ? `${spell.name}${"+".repeat(count)}` : spell.name;
};

export const getAdjustedSpellDc = (
  baseDc: string | number | null | undefined,
  spell: Spell,
  counts: SpellCountMap
) => {
  if (baseDc === undefined || baseDc === null || baseDc === "") return baseDc;
  if (isPendingSpell(spell)) return baseDc;
  const count = counts[spell.id] ?? 0;
  if (count < 2) return baseDc;
  const numeric = coerceNumeric(baseDc);
  if (numeric === null) return baseDc;
  return numeric - count;
};
