import { GameIcon, type GameIconName } from "@/components/ui/game-icons";
import type { Item } from "@/features/items/types/item-types";

import { boxRows, type RosterUnit } from "./unit-view";

/** A closed card's line: its kind's icon (named for screen readers and on hover) and its names. */
export type UnitLine = { label: string; icon: GameIconName; names: string[] };

/**
 * What a closed card lists under the profile (William, 8 Nov 2026: "show all the items, skills,
 * spells, boons/banes in lists like the items are now"): a line for each kind he has any of, a
 * group's items being what each member carries.
 */
export function unitLines(entry: RosterUnit, itemName: (item: Item) => string): UnitLine[] {
  const lists = boxRows(entry);
  const lines: UnitLine[] = [
    { label: "Items", icon: "items", names: lists.items.map(itemName) },
    { label: "Skills", icon: "skills", names: lists.skills.map((skill) => skill.name) },
    { label: "Spells", icon: "spells", names: lists.spells.map((spell) => spell.name) },
    {
      label: "Boons & Banes",
      icon: "specials",
      names: lists.specials.map((special) => special.name),
    },
  ];
  return lines.filter((line) => line.names.length > 0);
}

/** The line's caption: its kind's icon, the open card's, set on the text's baseline. */
const CAPTION = "mr-2 inline-block align-[-3px]";
const XP_TEXT = "ml-auto shrink-0 font-mono text-xs text-muted-foreground";

/**
 * A closed card's lists, one line per kind captioned by its icon (William, 8 Nov 2026: "instead
 * of saying items, skills etc for their row titles, lets just use the icons we have for them"),
 * wrapping when long, with his XP on the first line's right. A group's loadout cost is on the open
 * card (William, 8 Nov 2026: "can remove the loadout line on henchmen cards").
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
            <span className={CAPTION} title={line.label}>
              <GameIcon name={line.icon} className="h-4 w-4 text-accent-text" />
              <span className="sr-only">{line.label}</span>
            </span>
            {line.names.join(", ")}
          </p>
          {index === 0 ? xp : null}
        </div>
      ))}
    </div>
  );
}
