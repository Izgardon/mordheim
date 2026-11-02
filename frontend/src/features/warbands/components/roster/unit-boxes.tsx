import type { ReactNode } from "react";

import type { BoxTileKind } from "@/components/ui/box-tile";
import {
  GameIcon,
  SkillListIcon,
  SpecialKindIcon,
  type GameIconName,
  type SpecialKind,
} from "@/components/ui/game-icons";
import { skillList } from "@/features/skills/skill-list";
import type { Spell } from "@/features/spells/types/spell-types";

import { spellDifficulty } from "./advance/advance-table";
import type { BoxDetail } from "./RulesPanel";
import { pendingPicks, type PendingList, type RosterUnit } from "./unit-view";

export type Box = BoxDetail & { boxKind: BoxTileKind; icon?: ReactNode; pending?: PendingList };
export type Row = { key: string; label: string; icon: GameIconName; boxes: Box[] };

/** A unit's skill, special, spell or injury as its box shows it. */
type Entry = {
  name: string;
  type?: string | null;
  kind?: SpecialKind;
  description?: string | null;
  dc?: Spell["dc"];
  /** A spell's: how much easier it is for him. */
  dc_change?: number;
};

const NOUN: Record<PendingList, string> = {
  skills: "Skill",
  spells: "Spell",
  specials: "Boon or bane",
};
const BOX_KIND: Record<PendingList | "injuries", BoxTileKind> = {
  skills: "skill",
  specials: "special",
  spells: "spell",
  injuries: "injury",
};

/** A box's icon: a skill's list, a special's kind (Boons & Banes), an injury's; spells have none. */
function entryIcon(list: PendingList | "injuries", entry: Entry): ReactNode {
  if (list === "skills") return <SkillListIcon list={skillList(entry.type)} />;
  if (list === "specials") return <SpecialKindIcon kind={entry.kind} />;
  if (list === "injuries") return <GameIcon name="injuries" />;
  return undefined;
}

const PENDING_ICON: Record<PendingList, ReactNode> = {
  skills: <GameIcon name="skills" />,
  specials: <GameIcon name="specials" />,
  spells: undefined,
};

/**
 * One list's boxes on an open card: each entry with its second line (a skill's list, a spell's
 * lore and his difficulty, "Difficulty 7 → 6" once he rolled it again), then the picks an
 * advance left for later, each picked from its box.
 */
export function entryBoxes(
  unit: RosterUnit,
  list: PendingList | "injuries",
  entries: Entry[]
): Box[] {
  return [
    ...entries.map((entry) => {
      const difficulty = spellDifficulty(entry.dc, entry.dc_change);
      const line = [entry.type, difficulty && `Difficulty ${difficulty}`]
        .filter(Boolean)
        .join(" · ");
      return {
        name: entry.name,
        kind: line,
        text: entry.description,
        boxKind: BOX_KIND[list],
        icon: entryIcon(list, entry),
      };
    }),
    ...(list === "injuries"
      ? []
      : Array.from({ length: pendingPicks(unit, list) }, () => ({
          name: `${NOUN[list]} to choose`,
          kind: "Pick one",
          boxKind: "pending" as BoxTileKind,
          icon: PENDING_ICON[list],
          pending: list,
        }))),
  ];
}
