import { Chip } from "@/components/ui/chip";
import type { Race } from "@/features/races/types/race-types";
import type { Spell } from "@/features/spells/types/spell-types";

import { resolveAdvanceLabel } from "../../../utils/levelup-utils";
import type { RosterUnit } from "../unit-view";
import { statChange, statOf, type StatCode } from "./advance-table";
import BoonBanePicker from "./BoonBanePicker";
import ChoiceSelect, { type Choice } from "./ChoiceSelect";
import SkillPicker from "./SkillPicker";
import SpellPicker from "./SpellPicker";
import type { AdvanceFlow, PickKind } from "./useAdvanceFlow";

const STATS = new Set(["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"]);
const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const KINDS: Choice<PickKind>[] = [
  { value: "Skill", label: "Skill" },
  { value: "Spell", label: "Spell" },
  { value: "Special", label: "Boon or bane" },
];
const SPECIAL_NOUN: Record<string, string> = { boon: "boon", bane: "bane", trait: "trait" };

/**
 * "Gains …": what the advance gives, for the line above Confirm (William: "we already have the
 * Gains line"), and the warning a stat above his race maximum carries (it still applies).
 */
export function gainLine(
  flow: AdvanceFlow,
  entry: RosterUnit,
  race: Race | undefined
): { text: string; warning?: string } | null {
  const { advance } = flow;
  if (!advance || advance === "LGT") return null;
  if (STATS.has(advance)) {
    const stat = advance as StatCode;
    const change = statChange(stat, statOf(entry.unit, stat), statOf(race, stat));
    return { text: change.text, warning: change.overMax ? "Above his race maximum" : undefined };
  }
  if (flow.later)
    return { text: `A ${resolveAdvanceLabel(advance).toLowerCase()} to choose later` };
  if (flow.list === "skills" && flow.skill) return { text: `New skill: ${flow.skill.name}` };
  if (flow.list === "specials" && flow.special) {
    const noun = SPECIAL_NOUN[flow.special.kind ?? ""] ?? "boon or bane";
    return { text: `New ${noun}: ${flow.special.name}` };
  }
  const spell = flow.spell;
  if (!spell || flow.list !== "spells") return null;
  if (spell.known)
    return { text: `${spell.spell.name} gets easier: Difficulty ${spell.difficulty}` };
  return { text: `New spell: ${spell.spell.name}` };
}

/**
 * What a new skill row gives (William: "new skill can also mean new spell or special so we need a
 * dropdown for that"): a skill from his lists, a spell rolled on a lore (a warning for one who isn't
 * a caster) or a general boon or bane, each with its own picker, or "Choose later".
 */
export default function AdvanceGain({
  flow,
  entry,
  campaignId,
}: {
  flow: AdvanceFlow;
  entry: RosterUnit;
  campaignId: number;
}) {
  if (flow.row?.outcome.kind !== "skill") return null;
  const unit = entry.unit;
  const caster = "caster" in unit && (unit.caster === "Wizard" || unit.caster === "Priest");
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>New</span>
        <ChoiceSelect label="New" value={flow.kind} choices={KINDS} onChange={flow.setKind} />
        {flow.kind === "Spell" && !caster ? (
          <span className="text-xs font-semibold text-danger">Not a Wizard or Priest</span>
        ) : null}
        <Chip className="ml-auto" pressed={flow.later} onClick={() => flow.setLater(!flow.later)}>
          Choose later
        </Chip>
      </div>
      {flow.later ? null : flow.kind === "Skill" ? (
        <SkillPicker
          campaignId={campaignId}
          access={"available_skills" in unit ? unit.available_skills : undefined}
          large={unit.large}
          value={flow.skill}
          onChange={flow.setSkill}
        />
      ) : flow.kind === "Spell" ? (
        <SpellPicker
          campaignId={campaignId}
          known={("spells" in unit ? (unit.spells ?? []) : []) as Spell[]}
          value={flow.spell}
          onChange={flow.setSpell}
        />
      ) : (
        <BoonBanePicker campaignId={campaignId} value={flow.special} onChange={flow.setSpecial} />
      )}
    </div>
  );
}
