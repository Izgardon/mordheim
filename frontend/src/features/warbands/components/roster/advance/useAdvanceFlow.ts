import { useState } from "react";
import { toast } from "sonner";

import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandCacheUpdate, type WarbandUpdate } from "../../../api/warband-cache";
import { unitApi, type AdvancePick } from "../../../units/unit-api";
import { buildLevelUpPayload } from "../../../utils/levelup-utils";
import { LIST_KEY, unitName, type RosterUnit } from "../unit-view";
import {
  HENCHMEN_TABLE,
  HERO_TABLE,
  d6Stat,
  rowFor,
  type AdvanceRow,
  type StatCode,
} from "./advance-table";
import type { SpellChoice } from "./SpellPicker";

/** What a "New skill" row gives (William: "new skill can also mean new spell or special"). */
export type PickKind = "Skill" | "Spell" | "Special";

const PICKED: Record<PickKind, AdvancePick["list"]> = {
  Skill: "skills",
  Spell: "spells",
  Special: "specials",
};

/**
 * The advance code a table row gives once its choice is made, or null while it waits (and for the
 * talent when it already came up on this level-up: the group rolls again).
 */
function tableAdvance(
  row: AdvanceRow | undefined,
  stat: StatCode | null,
  kind: PickKind,
  talentBarred: boolean
) {
  const outcome = row?.outcome;
  if (!outcome) return null;
  if (outcome.kind === "skill") return kind;
  if (outcome.kind === "stat") return outcome.stat;
  if (outcome.kind === "talent") return talentBarred ? null : "LGT";
  return stat;
}

/**
 * The advance's steps (William: "it should be guiding the user"): the 2D6 on the unit's table, rolled,
 * typed or a row clicked as if the dice had shown it; the stat a row with two outcomes gives (a D6
 * presets it, and it can always be changed); what a new skill row gives (a skill, a spell or a boon
 * or bane) and its pick, or "Choose later"; and the save: one level-up with its pick.
 */
export function useAdvanceFlow(entry: RosterUnit | null, warbandId: number, onDone: () => void) {
  const updateCache = useWarbandCacheUpdate();
  const [roll2, setRoll2Raw] = useState<number | null>(null);
  /** A clicked row with a range ("2–5"): the result without a roll. */
  const [rowFrom, setRowFrom] = useState<number | null>(null);
  const [roll1, setRoll1Raw] = useState<number | null>(null);
  const [stat, setStat] = useState<StatCode | null>(null);
  const [kind, setKindRaw] = useState<PickKind>("Skill");
  const [skill, setSkill] = useState<Skill | null>(null);
  const [spell, setSpell] = useState<SpellChoice | null>(null);
  const [special, setSpecial] = useState<Special | null>(null);
  const [later, setLater] = useState(false);
  const [saving, setSaving] = useState(false);
  /** A henchman was promoted in this dialog: the group's roll again can't be the talent. */
  const [talentTaken, setTalentTaken] = useState(false);

  const isGroup = entry?.kind === "henchmen_group";
  const table = isGroup ? HENCHMEN_TABLE : HERO_TABLE;
  const row = rowFor(table, roll2) ?? table.find((each) => each.from === rowFrom);
  // the talent came up on this level-up already (its record is the group's last; William: "bar
  // another lads got talent"): the rest of the group rolls again
  const history = isGroup ? (entry.unit.level_up_history ?? []) : [];
  const talentBarred = isGroup && (talentTaken || history[history.length - 1]?.code === "LGT");
  const advance = tableAdvance(row, stat, kind, talentBarred);
  const list = advance && advance in PICKED ? PICKED[advance as PickKind] : undefined;
  const pick: AdvancePick | undefined =
    list === "skills" && skill
      ? { list, id: skill.id }
      : list === "spells" && spell?.mode === "roll"
        ? { list, lore: spell.lore, roll: spell.roll }
        : list === "spells" && spell
          ? { list, id: spell.spell.id }
          : list === "specials" && special
            ? { list, id: special.id }
            : undefined;
  const ready = Boolean(advance && advance !== "LGT" && (!list || later || pick));

  const clearPicks = () => {
    setSkill(null);
    setSpell(null);
    setSpecial(null);
    setLater(false);
  };
  /** A new row: its follow-ups start afresh. */
  const toRow = (roll: number | null, from: number | null) => {
    setRoll2Raw(roll);
    setRowFrom(from);
    setRoll1Raw(null);
    setStat(null);
    setKindRaw("Skill");
    clearPicks();
  };
  const reset = () => {
    toRow(null, null);
    setTalentTaken(false);
  };

  const confirm = async () => {
    if (!entry || !advance || !ready) return;
    setSaving(true);
    try {
      const payload = buildLevelUpPayload({
        unitName: unitName(entry.unit),
        selectedStat: advance,
        roll2d6Total: roll2,
        roll1d6Total: row?.outcome.kind === "d6" ? roll1 : null,
        nameKey: isGroup ? "group" : "hero",
      });
      const api = unitApi(entry.kind);
      const unit = await api.levelUp(warbandId, entry.unit.id, payload, later ? undefined : pick);
      updateCache(warbandId, { [LIST_KEY[entry.kind]]: [unit] } as WarbandUpdate);
      reset();
      onDone();
    } catch (error) {
      toast.error("The advance didn't save.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return {
    table,
    row,
    roll2,
    /** The 2D6 rolled or typed. */
    setRoll2: (roll: number | null) => toRow(roll, null),
    /** A row clicked, as if the dice had shown it: its roll when it has one, else none. */
    pickRow: (from: number) => {
      const picked = table.find((each) => each.from === from);
      if (picked) toRow(picked.from === picked.to ? picked.from : null, picked.from);
    },
    roll1,
    /** The D6 a row with two outcomes asks for, which presets the stat. */
    setRoll1: (roll: number | null) => {
      setRoll1Raw(roll);
      const outcome = row?.outcome;
      if (outcome?.kind === "d6") setStat(roll === null ? null : d6Stat(outcome, roll));
    },
    stat,
    setStat,
    kind,
    setKind: (next: PickKind) => {
      setKindRaw(next);
      clearPicks();
    },
    advance,
    list,
    skill,
    setSkill,
    spell,
    setSpell,
    special,
    setSpecial,
    later,
    setLater,
    pick,
    ready,
    saving,
    talentBarred,
    /** A henchman promoted: the table again, for the rest of the group's roll without the talent. */
    afterTalent: () => {
      toRow(null, null);
      setTalentTaken(true);
    },
    reset,
    confirm,
  };
}

export type AdvanceFlow = ReturnType<typeof useAdvanceFlow>;
