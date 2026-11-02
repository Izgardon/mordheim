import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { SkillListIcon } from "@/components/ui/game-icons";
import { SearchCombobox, type SearchOption } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { skillOptions } from "@/features/catalogue/search-options";
import { inPlayOnly } from "@/features/reference/in-play";
import { skillList } from "@/features/skills/skill-list";
import type { Skill } from "@/features/skills/types/skill-types";
import { useCatalogue } from "@/lib/catalogue-queries";

import {
  buildAvailableSkillsPayload,
  parseAvailableSkills,
  skillAbbrevToType,
} from "../../../utils/warband-utils";

const ALL = "all";
const CORE = Object.values(skillAbbrevToType);

const clip = (text: string, length = 140) =>
  text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;

/**
 * A new skill, guided (William): his skill lists as chips ("the unit should have the skill lists
 * already"), that list's skills as rows with their rules, and "Show all" for the rest, greyed with
 * the "not in his lists" warning and still pickable. Only the campaign's skills show (William: "i
 * also shouldnt see skills that arent part of my campaign"). The pick shows its full rules.
 */
export default function SkillPicker({
  campaignId,
  access,
  large,
  value,
  onChange,
}: {
  campaignId: number;
  /** The unit's `available_skills`. */
  access: unknown;
  large?: boolean | null;
  value: Skill | null;
  onChange: (skill: Skill | null) => void;
}) {
  const skills = inPlayOnly(useCatalogue("skills", campaignId).data ?? []);
  const settings = useSettingsById();
  const lists = buildAvailableSkillsPayload(parseAvailableSkills(access));
  const tabs = lists.length ? lists : CORE;
  const [tab, setTab] = useState(tabs[0] ?? ALL);
  const rows = skillOptions(skills, { settings, large, access: lists });
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const inTab = (option: SearchOption) => {
    const skill = byId.get(Number(option.id));
    return !skill || tab === ALL || skill.type === tab;
  };
  const options = rows.filter(inTab).map((option) => ({
    ...option,
    group: tab === ALL ? option.group : undefined,
    subtitle: clip(byId.get(Number(option.id))?.description ?? option.subtitle ?? ""),
  }));

  if (value) {
    return (
      <div className="flex flex-col gap-1.5 border border-accent-line bg-accent-soft p-2.5">
        <span className="flex items-center gap-1.5 text-sm font-bold text-head">
          <SkillListIcon list={skillList(value.type)} className="text-kind-skill" />
          {value.name}
          <span className="font-normal text-muted-foreground">· {value.type}</span>
          <button
            type="button"
            className="ml-auto text-xs font-bold text-accent-text hover:underline"
            onClick={() => onChange(null)}
          >
            Change
          </button>
        </span>
        <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-text2">
          {value.description}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Skill lists" className="flex flex-wrap gap-1.5">
        {[...tabs, ALL].map((key) => (
          <Chip key={key} pressed={tab === key} onClick={() => setTab(key)}>
            {key === ALL ? null : <SkillListIcon list={skillList(key)} />}
            {key === ALL ? "Show all" : key}
          </Chip>
        ))}
      </div>
      <SearchCombobox
        inline
        label="Search skills"
        placeholder="Search skills"
        emptyText="No skill matches."
        options={options}
        onPick={(option) => onChange(byId.get(Number(option.id)) ?? null)}
      />
    </div>
  );
}
