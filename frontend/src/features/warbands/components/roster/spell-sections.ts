import { praysFrom } from "@/features/spells/spell-lores";
import type { Spell } from "@/features/spells/types/spell-types";
import { useCatalogue } from "@/lib/catalogue-queries";

import { boxRows, pendingPicks, type RosterUnit } from "./unit-view";

export type SpellSection<S> = {
  key: "prayers" | "spells";
  label: "Prayers" | "Spells";
  spells: S[];
  /** The spell picks still to make sit here. */
  picks: boolean;
};

/**
 * A unit's spells as his card heads them (William, 26 Nov 2026): his prayers under "Prayers", the
 * rest under "Spells", a section for each he has; the picks still to make go under "Prayers" when
 * he prays (`prays`) and he holds no other spell.
 */
export function spellSections<S extends Pick<Spell, "is_prayer">>(
  spells: S[],
  picks: number,
  prays: boolean
): SpellSection<S>[] {
  const prayers = spells.filter((spell) => spell.is_prayer);
  const others = spells.filter((spell) => !spell.is_prayer);
  const picksIn = prays && !others.length ? "prayers" : "spells";
  const sections: SpellSection<S>[] = [
    {
      key: "prayers",
      label: "Prayers",
      spells: prayers,
      picks: picks > 0 && picksIn === "prayers",
    },
    { key: "spells", label: "Spells", spells: others, picks: picks > 0 && picksIn === "spells" },
  ];
  return sections.filter((section) => section.spells.length > 0 || section.picks);
}

/**
 * Whether the unit prays: his spells are all prayers, or, knowing none yet, one of his lores is a
 * prayer list (read from the campaign's spells only then).
 */
export function usePrays(entry: RosterUnit, campaignId: number) {
  const known = boxRows(entry).spells as Spell[];
  const lores =
    "available_spell_types" in entry.unit ? (entry.unit.available_spell_types ?? []) : [];
  const ask = !known.length && lores.length > 0 && pendingPicks(entry, "spells") > 0;
  const catalogue = useCatalogue("spells", campaignId, { enabled: ask }).data;
  if (known.length) return known.every((spell) => spell.is_prayer);
  return ask && praysFrom(lores, catalogue ?? []);
}
