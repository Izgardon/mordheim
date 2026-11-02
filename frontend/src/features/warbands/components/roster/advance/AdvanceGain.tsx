import { Chip } from "@/components/ui/chip";
import type { Race } from "@/features/races/types/race-types";
import type { Spell } from "@/features/spells/types/spell-types";

import { resolveAdvanceLabel } from "../../../utils/levelup-utils";
import type { RosterUnit } from "../unit-view";
import { statChange, statOf, type StatCode } from "./advance-table";
import SkillPicker from "./SkillPicker";
import SpellPicker from "./SpellPicker";
import type { AdvanceFlow } from "./useAdvanceFlow";

const STATS = new Set(["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"]);
const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/** "Gains …": what the advance gives, for the line above Confirm. */
export function gainLine(flow: AdvanceFlow, entry: RosterUnit, race: Race | undefined) {
  const { advance } = flow;
  if (!advance || advance === "LGT") return "";
  if (STATS.has(advance)) {
    const stat = advance as StatCode;
    return statChange(stat, statOf(entry.unit, stat), statOf(race, stat)).text;
  }
  if (flow.later) return `A ${resolveAdvanceLabel(advance).toLowerCase()} to choose later`;
  if (flow.skill && flow.list === "skills") return `New skill: ${flow.skill.name}`;
  const spell = flow.spell;
  if (!spell || flow.list !== "spells") return "";
  if (spell.mode === "roll" && spell.known)
    return `${spell.spell.name} gets easier: Difficulty ${spell.difficulty}`;
  return `New spell: ${spell.spell.name}`;
}

/**
 * What the advance gives, as the step after the roll: a stat against his race's maximum (over it
 * warns and still applies), or a new skill or spell picked here, a caster's choice between them,
 * and "Choose later".
 */
export default function AdvanceGain({
  flow,
  entry,
  race,
  campaignId,
  warbandId,
}: {
  flow: AdvanceFlow;
  entry: RosterUnit;
  race: Race | undefined;
  campaignId: number;
  warbandId: number;
}) {
  const { advance, list } = flow;
  if (!advance || advance === "LGT") return null;
  if (STATS.has(advance)) {
    const stat = advance as StatCode;
    const change = statChange(stat, statOf(entry.unit, stat), statOf(race, stat));
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-lg font-bold text-head">{change.text}</span>
        {change.overMax ? (
          <span className="text-xs font-semibold text-danger">Above his race maximum</span>
        ) : null}
      </div>
    );
  }
  if (!list || list === "specials") return null;
  const unit = entry.unit;
  const caster = "caster" in unit && (unit.caster === "Wizard" || unit.caster === "Priest");
  const fromSkillRow = flow.row?.outcome.kind === "skill";
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {caster && fromSkillRow ? (
          <div role="group" aria-label="Skill or spell" className="flex gap-1.5">
            <Chip pressed={!flow.takeSpell} onClick={() => flow.setTakeSpell(false)}>
              New skill
            </Chip>
            <Chip pressed={flow.takeSpell} onClick={() => flow.setTakeSpell(true)}>
              New spell
            </Chip>
          </div>
        ) : (
          <span className={LABEL}>{list === "skills" ? "New skill" : "New spell"}</span>
        )}
        <Chip className="ml-auto" pressed={flow.later} onClick={() => flow.setLater(!flow.later)}>
          Choose later
        </Chip>
      </div>
      {flow.later ? null : list === "skills" ? (
        <SkillPicker
          campaignId={campaignId}
          warbandId={warbandId}
          access={"available_skills" in unit ? unit.available_skills : undefined}
          large={unit.large}
          value={flow.skill}
          onChange={flow.setSkill}
        />
      ) : (
        <SpellPicker
          campaignId={campaignId}
          known={("spells" in unit ? (unit.spells ?? []) : []) as Spell[]}
          value={flow.spell}
          onChange={flow.setSpell}
        />
      )}
    </div>
  );
}
