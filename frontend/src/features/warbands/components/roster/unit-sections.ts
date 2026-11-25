import { sectionsOf, type SelectSection } from "@/components/ui/sectioned-select";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import type { UnitKindKey } from "../../types/units";
import { unitName, type RosterUnit } from "./unit-view";

/** The headings a short unit picker sorts units under, in the roster's order. */
export const UNIT_SECTIONS: { key: UnitKindKey; label: string }[] = [
  { key: "hero", label: "Heroes" },
  { key: "henchmen_group", label: "Henchmen" },
  { key: "hireling", label: "Hired swords" },
];

/** A unit as a picker's value: "hero:12". */
export const unitValue = (entry: RosterUnit) => `${entry.kind}:${entry.unit.id}`;

/** A picked value back as the place an item goes; null for none. */
export function placeOf(value: string): ItemPlace | null {
  const [type, id] = value.split(":");
  return type ? { type: type as ItemPlace["type"], id: Number(id) } : null;
}

/**
 * Where an item may go (Equip, Give to and Move to): heroes and henchmen. A hired sword's or dramatis
 * persona's kit changes only through his Edit form (William, 25 Nov 2026), and the server refuses a move
 * to him.
 */
export const unitSections = (units: RosterUnit[]): SelectSection[] =>
  sectionsOf(
    units.filter((entry) => entry.kind !== "hireling"),
    UNIT_SECTIONS.filter((section) => section.key !== "hireling"),
    (entry) => entry.kind,
    (entry) => ({ value: unitValue(entry), label: unitName(entry.unit) })
  );
