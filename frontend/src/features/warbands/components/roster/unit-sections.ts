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

/** Units under Heroes, Henchmen and Hired swords, for Equip, Give to and Move to. */
export const unitSections = (units: RosterUnit[]): SelectSection[] =>
  sectionsOf(
    units,
    UNIT_SECTIONS,
    (entry) => entry.kind,
    (entry) => ({ value: unitValue(entry), label: unitName(entry.unit) })
  );
