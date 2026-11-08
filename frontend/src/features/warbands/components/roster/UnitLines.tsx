import type { Item } from "@/features/items/types/item-types";

import { boxRows, type RosterUnit } from "./unit-view";

/** A closed card's line: its caption and the names it lists. */
export type UnitLine = { label: string; names: string[] };

/**
 * What a closed card lists under the profile (William, 8 Nov 2026: "show all the items, skills,
 * spells, boons/banes in lists like the items are now"): a line for each kind he has any of, a
 * group's items being what each member carries.
 */
export function unitLines(entry: RosterUnit, itemName: (item: Item) => string): UnitLine[] {
  const lists = boxRows(entry);
  const lines: UnitLine[] = [
    { label: "Items", names: lists.items.map(itemName) },
    { label: "Skills", names: lists.skills.map((skill) => skill.name) },
    { label: "Spells", names: lists.spells.map((spell) => spell.name) },
    { label: "Boons & Banes", names: lists.specials.map((special) => special.name) },
  ];
  return lines.filter((line) => line.names.length > 0);
}

const LABEL = "mr-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const XP_TEXT = "ml-auto shrink-0 font-mono text-xs text-muted-foreground";

/**
 * A closed card's lists, one labelled line per kind, wrapping when long, with his XP on the first
 * line's right. A group's loadout cost is on the open card (William, 8 Nov 2026: "can remove the
 * loadout line on henchmen cards and dont need to write 'Each carries' just say items").
 */
export default function UnitLines({
  entry,
  itemName,
  xpText,
}: {
  entry: RosterUnit;
  itemName: (item: Item) => string;
  xpText: string;
}) {
  const lines = unitLines(entry, itemName);
  const xp = <span className={XP_TEXT}>{xpText}</span>;
  if (!lines.length) return <div className="flex">{xp}</div>;
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, index) => (
        <div key={line.label} className="flex items-baseline gap-3">
          <p className="m-0 min-w-0 break-words text-[13px] text-text2">
            <span className={LABEL}>{line.label}</span>
            {line.names.join(", ")}
          </p>
          {index === 0 ? xp : null}
        </div>
      ))}
    </div>
  );
}
