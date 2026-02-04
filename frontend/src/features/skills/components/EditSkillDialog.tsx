import type { ReactNode } from "react";

import SkillFormDialog from "./SkillFormDialog";

import type { Skill } from "../types/skill-types";

type EditSkillDialogProps = {
  skill: Skill;
  typeOptions?: string[];
  onUpdated: (skill: Skill) => void;
  onDeleted: (skillId: number) => void;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function EditSkillDialog({
  skill,
  typeOptions = [],
  onUpdated,
  onDeleted,
  trigger,
  open: openProp,
  onOpenChange,
}: EditSkillDialogProps) {
  return (
    <SkillFormDialog
      mode="edit"
      skill={skill}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
      typeOptions={typeOptions}
      trigger={trigger}
      open={openProp}
      onOpenChange={onOpenChange}
    />
  );
}
