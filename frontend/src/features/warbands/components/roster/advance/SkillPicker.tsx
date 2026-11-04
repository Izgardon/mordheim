import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { SkillListIcon } from "@/components/ui/game-icons";
import { SearchCombobox, type SearchOption } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { skillOptions } from "@/features/catalogue/search-options";
import { inPlayOnly } from "@/features/reference/in-play";
import { cameThrough, isCore, unitGroups, useSkillGroups } from "@/features/skills/skill-groups";
import { skillList } from "@/features/skills/skill-list";
import type { Skill } from "@/features/skills/types/skill-types";
import { useCatalogue } from "@/lib/catalogue-queries";

import { accessNames } from "../../../utils/warband-utils";

const ALL = "all";

const clip = (text: string, length = 140) =>
  text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;

/**
 * A new skill, guided (William): a chip for each skill group in his skill access ("the unit should
 * have the skill lists already") with that group's skills as rows with their rules, and "Show all"
 * for the rest, greyed with the "not in his groups" warning and still pickable; a skill in two of
 * his groups shows under both. Only the campaign's skills show (William: "i also shouldnt see
 * skills that arent part of my campaign"). The pick shows its full rules and the group it comes
 * through.
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
  const groups = useSkillGroups(campaignId);
  const his = unitGroups(groups, accessNames(access));
  const tabs = his.length ? his : groups.groups.filter(isCore);
  const [picked, setTab] = useState<number | typeof ALL | null>(null);
  const tab = picked ?? tabs[0]?.id ?? ALL; // his first group once the groups have loaded
  const shown = tab === ALL ? undefined : groups.byId.get(tab);
  const rows = skillOptions(skills, { settings, groups, large, access: his });
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const inTab = (option: SearchOption) => !shown || shown.skill_ids.includes(Number(option.id));
  const options = rows.filter(inTab).map((option) => ({
    ...option,
    group: tab === ALL ? option.group : undefined,
    subtitle: clip(byId.get(Number(option.id))?.description ?? option.subtitle ?? ""),
  }));

  if (value) {
    const via = cameThrough(groups, value.id, his);
    return (
      <div className="flex flex-col gap-1.5 border border-accent-line bg-accent-soft p-2.5">
        <span className="flex items-center gap-1.5 text-sm font-bold text-head">
          <SkillListIcon list={skillList(via?.access_name)} className="text-kind-skill" />
          {value.name}
          {via ? <span className="font-normal text-muted-foreground">· {via.name}</span> : null}
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
      <div role="group" aria-label="Skill groups" className="flex flex-wrap gap-1.5">
        {tabs.map((group) => (
          <Chip key={group.id} pressed={tab === group.id} onClick={() => setTab(group.id)}>
            <SkillListIcon list={skillList(group.access_name)} />
            {group.name}
          </Chip>
        ))}
        <Chip pressed={tab === ALL} onClick={() => setTab(ALL)}>
          Show all
        </Chip>
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
