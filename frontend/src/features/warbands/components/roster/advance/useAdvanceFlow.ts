import { useState } from "react";
import { toast } from "sonner";

import type { Skill } from "@/features/skills/types/skill-types";
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

const PICKED: Record<string, AdvancePick["list"]> = {
  Skill: "skills",
  Spell: "spells",
  Special: "specials",
};

/** The advance code a table row gives once its follow-up is made, or null while it waits. */
function tableAdvance(
  row: AdvanceRow | undefined,
  roll1: number | null,
  chosen: StatCode | null,
  takeSpell: boolean
) {
  const outcome = row?.outcome;
  if (!outcome) return null;
  if (outcome.kind === "skill") return takeSpell ? "Spell" : "Skill";
  if (outcome.kind === "stat") return outcome.stat;
  if (outcome.kind === "choose") return chosen;
  if (outcome.kind === "d6") return roll1 === null ? null : d6Stat(outcome, roll1);
  return "LGT";
}

/**
 * The advance's steps (William: "it should be guiding the user"): the 2D6 on the unit's table
 * (or an advance chosen by hand), the follow-up the row asks for, the pick a new skill or spell
 * gives (or "Choose later"), and the save: one level-up with its pick.
 */
export function useAdvanceFlow(entry: RosterUnit | null, warbandId: number, onDone: () => void) {
  const updateCache = useWarbandCacheUpdate();
  const [roll2, setRoll2Raw] = useState<number | null>(null);
  const [roll1, setRoll1] = useState<number | null>(null);
  const [chosen, setChosen] = useState<StatCode | null>(null);
  const [byHand, setByHandRaw] = useState<string | null>(null);
  const [takeSpell, setTakeSpell] = useState(false);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [spell, setSpell] = useState<SpellChoice | null>(null);
  const [later, setLater] = useState(false);
  const [saving, setSaving] = useState(false);

  const isGroup = entry?.kind === "henchmen_group";
  const table = isGroup ? HENCHMEN_TABLE : HERO_TABLE;
  const row = byHand ? undefined : rowFor(table, roll2);
  const advance = byHand ?? tableAdvance(row, roll1, chosen, takeSpell);
  const list = advance ? PICKED[advance] : undefined;
  const pick: AdvancePick | undefined =
    list === "skills" && skill
      ? { list, id: skill.id }
      : list === "spells" && spell?.mode === "roll"
        ? { list, lore: spell.lore, roll: spell.roll }
        : list === "spells" && spell
          ? { list, id: spell.spell.id }
          : undefined;
  // a boon or bane is picked later from the card
  const deferred = later || list === "specials";
  const ready = Boolean(advance && advance !== "LGT" && (!list || deferred || pick));

  const clearPicks = () => {
    setSkill(null);
    setSpell(null);
    setLater(false);
  };
  const reset = () => {
    setRoll2Raw(null);
    setRoll1(null);
    setChosen(null);
    setByHandRaw(null);
    setTakeSpell(false);
    clearPicks();
  };
  const setRoll2 = (roll: number | null) => {
    setRoll2Raw(roll);
    setRoll1(null);
    setChosen(null);
    setByHandRaw(null);
    setTakeSpell(false);
    clearPicks();
  };
  const setByHand = (code: string | null) => {
    setByHandRaw(code);
    clearPicks();
  };

  const confirm = async () => {
    if (!entry || !advance || !ready) return;
    setSaving(true);
    try {
      const payload = buildLevelUpPayload({
        unitName: unitName(entry.unit),
        selectedStat: advance,
        roll2d6Total: byHand ? null : roll2,
        roll1d6Total: byHand ? null : roll1,
        nameKey: isGroup ? "group" : "hero",
      });
      const api = unitApi(entry.kind);
      const unit = await api.levelUp(
        warbandId,
        entry.unit.id,
        payload,
        deferred ? undefined : pick
      );
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
    setRoll2,
    roll1,
    setRoll1,
    chosen,
    setChosen,
    byHand,
    setByHand,
    takeSpell,
    setTakeSpell: (on: boolean) => {
      setTakeSpell(on);
      clearPicks();
    },
    advance,
    list,
    skill,
    setSkill,
    spell,
    setSpell,
    later: deferred,
    setLater,
    pick,
    ready,
    saving,
    reset,
    confirm,
  };
}

export type AdvanceFlow = ReturnType<typeof useAdvanceFlow>;
