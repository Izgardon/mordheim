import type { ReactNode } from "react";

import type { BoxTileKind } from "@/components/ui/box-tile";
import {
  GameIcon,
  SkillListIcon,
  SpecialIcon,
  type GameIconName,
  type SkillList,
  type SpecialCategory,
  type SpecialKind,
} from "@/components/ui/game-icons";
import type { Spell } from "@/features/spells/types/spell-types";

import { spellDifficulty } from "./advance/advance-table";
import type { BoxDetail } from "./RulesPanel";
import { pendingPicks, type PendingList, type RosterUnit } from "./unit-view";

/**
 * A box in an open card's rows: `subtitle` is its tile's second line, only what it is (an item's
 * subtype, a skill's group, a spell's lore, a special's type: William, 22 Nov 2026), while `kind`
 * keeps the rest (stats, difficulty) for its opened panel.
 */
export type Box = BoxDetail & {
  subtitle?: string;
  boxKind: BoxTileKind;
  icon?: ReactNode;
  pending?: PendingList;
};
export type Row = { key: string; label: string; icon: GameIconName; boxes: Box[] };

/**
 * A unit's skill, special or spell as its box shows it: a skill's `type` is the group it comes
 * through for him and `list` that group's icon (`cameThrough`).
 */
export type Entry = {
  name: string;
  type?: string | null;
  list?: SkillList;
  kind?: SpecialKind;
  category?: SpecialCategory;
  description?: string | null;
  dc?: Spell["dc"];
  /** A spell's: how much easier it is for him. */
  dc_change?: number;
};

const NOUN: Record<PendingList, string> = {
  skills: "Skill",
  spells: "Spell",
  specials: "Special",
};
const BOX_KIND: Record<PendingList, BoxTileKind> = {
  skills: "skill",
  specials: "special",
  spells: "spell",
};

/** A box's icon: a skill's group, a special's category in its kind's colour, a spell's book. */
function entryIcon(list: PendingList, entry: Entry): ReactNode {
  if (list === "skills") return <SkillListIcon list={entry.list ?? "special"} />;
  if (list === "specials") return <SpecialIcon category={entry.category} kind={entry.kind} />;
  return <GameIcon name="spells" />;
}

const PENDING_ICON: Record<PendingList, ReactNode> = {
  skills: <GameIcon name="skills" />,
  specials: <GameIcon name="specials" />,
  spells: <GameIcon name="spells" />,
};

/** A pill's type, less the "Warband - " a warband's own rule carries, which a phone cuts off (William, 23 Nov 2026). */
export const pillType = (type: string | null | undefined) =>
  (type ?? "").replace(/^Warband - /, "");

/**
 * One list's boxes on an open card: each entry with what it is (a skill's group, a spell's lore)
 * and its panel's line (a spell's lore and his difficulty, "Difficulty 7 → 6" once he rolled it
 * again), then the picks an advance left for later, each picked from its box (`picks`: how many
 * and what they are, "Prayer"; by default all of the list's).
 */
export function entryBoxes(
  unit: RosterUnit,
  list: PendingList,
  entries: Entry[],
  picks: { count: number; noun: string } = { count: pendingPicks(unit, list), noun: NOUN[list] }
): Box[] {
  return [
    ...entries.map((entry) => {
      const difficulty = spellDifficulty(entry.dc, entry.dc_change);
      const line = [entry.type, difficulty && `Difficulty ${difficulty}`]
        .filter(Boolean)
        .join(" · ");
      return {
        name: entry.name,
        subtitle: pillType(entry.type),
        kind: line,
        text: entry.description,
        special: list === "specials",
        boxKind: BOX_KIND[list],
        icon: entryIcon(list, entry),
      };
    }),
    ...Array.from({ length: picks.count }, () => ({
      name: `${picks.noun} to choose`,
      subtitle: "Pick one",
      kind: "Pick one",
      boxKind: "pending" as BoxTileKind,
      icon: PENDING_ICON[list],
      pending: list,
    })),
  ];
}

/**
 * On a phone, where a row's boxes sit two abreast, the cell an opened box's panel follows: the
 * last of the line holding the box (William, 25 Nov 2026: "directly under the line of the box that
 * was tapped"), or the row's last cell when the line isn't full.
 */
export const panelAfter = (index: number, cells: number) =>
  Math.min(index - (index % 2) + 1, cells - 1);
