import { Chip } from "@/components/ui/chip";
import { SearchMultiSelect, type SearchOption } from "@/components/ui/search-select";
import { useCatalogue } from "@/lib/catalogue-queries";

import { skillAbbrevToType } from "../../../utils/warband-utils";

const STANDARD = Object.entries(skillAbbrevToType);

/**
 * Skill access (design E): the five standard lists and Special, which opens the campaign's other
 * skill lists (Necromancy, a warband's own) on the searchable select, each with its count of
 * skills. Holds the form's checkbox record.
 */
export default function SkillAccessField({
  campaignId,
  value,
  onChange,
}: {
  campaignId: number;
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  const skills = useCatalogue("skills", campaignId).data ?? [];
  const standardTypes = new Set(Object.values(skillAbbrevToType));
  const counts = new Map<string, number>();
  for (const skill of skills) {
    const type = skill.type?.trim();
    if (type && !standardTypes.has(type)) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const specialTypes = [...counts.keys()].sort();
  const groupOption = (type: string): SearchOption => ({
    id: type,
    title: type,
    subtitle: `${counts.get(type) ?? 0} skills`,
  });
  const toggle = (key: string) => onChange({ ...value, [key]: !value[key] });

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
        Skill access
      </span>
      <div role="group" aria-label="Skill access" className="flex flex-wrap gap-1.5">
        {STANDARD.map(([key, label]) => (
          <Chip key={key} pressed={Boolean(value[key])} onClick={() => toggle(key)}>
            {label}
          </Chip>
        ))}
        <Chip
          pressed={Boolean(value.Spc)}
          onClick={() => {
            if (!value.Spc) return onChange({ ...value, Spc: true });
            const next: Record<string, boolean> = { ...value, Spc: false };
            for (const key of Object.keys(next))
              if (!(key in skillAbbrevToType) && key !== "Spc") delete next[key];
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
          options={specialTypes.map(groupOption)}
          values={Object.keys(value)
            .filter((key) => value[key] && !(key in skillAbbrevToType) && key !== "Spc")
            .map(groupOption)}
          onChange={(next) => {
            const picked = new Set(next.map((option) => String(option.id)));
            const record: Record<string, boolean> = {};
            for (const [key, on] of Object.entries(value))
              if (key in skillAbbrevToType || key === "Spc") record[key] = on;
            for (const type of picked) record[type] = true;
            onChange(record);
          }}
        />
      ) : null}
    </div>
  );
}
