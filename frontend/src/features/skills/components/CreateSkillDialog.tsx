import type { ReactNode } from "react";

import SkillFormDialog from "./SkillFormDialog";

import type { Skill } from "../types/skill-types";

type CreateSkillDialogProps = {
  campaignId: number;
  onCreated: (skill: Skill) => void;
  typeOptions?: string[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function CreateSkillDialog({
  campaignId,
  onCreated,
  typeOptions = [],
  trigger,
  open: openProp,
  onOpenChange,
}: CreateSkillDialogProps) {
  return (
    <SkillFormDialog
      mode="create"
      campaignId={campaignId}
      onCreated={onCreated}
      typeOptions={typeOptions}
      trigger={trigger}
      open={openProp}
      onOpenChange={onOpenChange}
    />
  );
}
