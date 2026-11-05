import { Button } from "@/components/ui/button";
import { ReferenceDetail } from "@/features/reference/ReferenceDetail";
import { rowDomId } from "@/features/reference/ReferenceList";
import { cn } from "@/lib/utils";

import type { SkillGroupRow } from "../skill-group-rows";
import type { Skill, SkillGroup } from "../types/skill-types";

type GroupSkillsProps = {
  row: SkillGroupRow;
  /** The skill a link or a save landed on (`?open=`): scrolled to here when this row holds it. */
  openId: string | null;
  /** Edit skill and Edit skill group, for those who edit the catalogue. */
  onEditSkill: ((skill: Skill) => void) | null;
  onEditGroup: ((group: SkillGroup) => void) | null;
  isMobile: boolean;
};

/** An open skill group: each of its skills with its rules, Edit skill beside each. */
export default function GroupSkills({
  row,
  openId,
  onEditSkill,
  onEditGroup,
  isMobile,
}: GroupSkillsProps) {
  const { group } = row;
  return (
    <ReferenceDetail isMobile={isMobile}>
      {group && onEditGroup ? (
        <Button
          variant="secondary"
          className="min-h-10 self-start"
          onClick={() => onEditGroup(group)}
        >
          Edit skill group
        </Button>
      ) : null}
      {row.skills.length === 0 ? (
        <p className="m-0 text-sm text-text2">No skills in this group.</p>
      ) : (
        <ul className="m-0 flex max-w-[760px] list-none flex-col gap-3 p-0">
          {row.skills.map((skill) => {
            const key = String(skill.id);
            const linked = key === openId;
            return (
              <li
                key={key}
                id={linked ? rowDomId(key) : undefined}
                className={cn(
                  "flex scroll-mt-24 flex-col gap-1 border-t border-line pt-3 first:border-t-0 first:pt-0",
                  linked && "border-l-2 border-l-accent pl-3"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="m-0 pt-1 text-[15px] font-bold text-head">{skill.name}</h3>
                  {onEditSkill ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Edit skill ${skill.name}`}
                      className="shrink-0"
                      onClick={() => onEditSkill(skill)}
                    >
                      Edit skill
                    </Button>
                  ) : null}
                </div>
                {skill.description ? (
                  <p className="m-0 max-w-[72ch] whitespace-pre-line text-sm leading-relaxed text-text2">
                    {skill.description}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </ReferenceDetail>
  );
}
