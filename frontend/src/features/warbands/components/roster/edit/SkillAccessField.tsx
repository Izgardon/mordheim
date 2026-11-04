import { Chip } from "@/components/ui/chip";
import { SearchMultiSelect, type SearchOption } from "@/components/ui/search-select";
import { useWhoCan } from "@/features/items/api/who-can-queries";
import { isCore, useSkillGroups } from "@/features/skills/skill-groups";
import type { SkillGroup } from "@/features/skills/types/skill-types";

import { skillAbbrevToType } from "../../../utils/warband-utils";

const STANDARD = Object.entries(skillAbbrevToType);
const isStandard = (key: string) => key in skillAbbrevToType || key === "Spc";

/**
 * Skill access (design E): the five core skill groups and Special, which opens the campaign's
 * other groups on the searchable select, those open to his warband first, each with its count of
 * skills. Holds the form's checkbox record; a group is stored by the name a unit's access names it
 * by (`access_name`), so a campaign's renamed version of a book group still answers to it.
 */
export default function SkillAccessField({
  campaignId,
  warbandId,
  value,
  onChange,
}: {
  campaignId: number;
  warbandId: number;
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  const groups = useSkillGroups(campaignId);
  const open = useWhoCan(campaignId, warbandId).skillGroupIds;
  const special = groups.groups.filter((group) => !isCore(group));
  const ranked = [
    ...special.filter((group) => open.has(group.id)),
    ...special.filter((group) => !open.has(group.id)),
  ];
  const groupOption = (group: SkillGroup): SearchOption => ({
    id: group.access_name,
    title: group.name,
    subtitle: `${group.skill_ids.length} skills`,
  });
  const pickedOption = (key: string): SearchOption => {
    const group = groups.byAccess.get(key.trim().toLowerCase());
    return group ? groupOption(group) : { id: key, title: key };
  };
  const coreName = (name: string) =>
    groups.groups.find((group) => isCore(group) && group.access_name === name)?.name ?? name;
  const toggle = (key: string) => onChange({ ...value, [key]: !value[key] });

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
        Skill access
      </span>
      <div role="group" aria-label="Skill access" className="flex flex-wrap gap-1.5">
        {STANDARD.map(([key, name]) => (
          <Chip key={key} pressed={Boolean(value[key])} onClick={() => toggle(key)}>
            {coreName(name)}
          </Chip>
        ))}
        <Chip
          pressed={Boolean(value.Spc)}
          onClick={() => {
            if (!value.Spc) return onChange({ ...value, Spc: true });
            const next: Record<string, boolean> = { ...value, Spc: false };
            for (const key of Object.keys(next)) if (!isStandard(key)) delete next[key];
            onChange(next);
          }}
        >
          Special
        </Chip>
      </div>
      {value.Spc ? (
        <SearchMultiSelect
          addLabel="Choose a special skill group"
          placeholder="Search skill groups"
          emptyText="No skill group matches."
          options={ranked.map(groupOption)}
          values={Object.keys(value)
            .filter((key) => value[key] && !isStandard(key))
            .map(pickedOption)}
          onChange={(next) => {
            const record: Record<string, boolean> = {};
            for (const [key, on] of Object.entries(value)) if (isStandard(key)) record[key] = on;
            for (const option of next) record[String(option.id)] = true;
            onChange(record);
          }}
        />
      ) : null}
    </div>
  );
}
