import { Chip } from "@/components/ui/chip";
import { useCatalogue } from "@/lib/catalogue-queries";

import { skillAbbrevToType } from "../../../utils/warband-utils";

const STANDARD = Object.entries(skillAbbrevToType);

/**
 * Skill access (design E): the five standard lists and Special, which opens the campaign's other
 * skill lists (Necromancy, a warband's own) to pick from. Holds the form's checkbox record.
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
  const specialTypes = [
    ...new Set(
      skills
        .map((skill) => skill.type?.trim())
        .filter((type): type is string => Boolean(type) && !standardTypes.has(type!))
    ),
  ].sort();
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
            for (const type of specialTypes) delete next[type];
            onChange(next);
          }}
        >
          Special
        </Chip>
      </div>
      {value.Spc ? (
        <div role="group" aria-label="Special skill lists" className="flex flex-wrap gap-1.5">
          {specialTypes.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">
              The campaign has no special skill lists.
            </span>
          ) : null}
          {specialTypes.map((type) => (
            <Chip key={type} pressed={Boolean(value[type])} onClick={() => toggle(type)}>
              {type}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
