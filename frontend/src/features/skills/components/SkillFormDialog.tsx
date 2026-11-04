import { useCallback, useEffect } from "react";
import type { ReactNode } from "react";

import { Button } from "@components/button";

import {
  CatalogueFormDialog,
  editEntryTrigger,
} from "@/features/catalogue/components/CatalogueFormDialog";
import { useControllableOpen } from "@/features/catalogue/hooks/useControllableOpen";

import { useSkillForm } from "../hooks/useSkillForm";
import { groupsOf, useSkillGroups } from "../skill-groups";
import SkillFormFields from "./SkillFormFields";

import type { Skill } from "../types/skill-types";

type SkillFormDialogBaseProps = {
  /** The campaign: a book skill's edit makes its version. */
  campaignId: number;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type SkillFormDialogCreateProps = SkillFormDialogBaseProps & {
  mode: "create";
  onCreated: (skill: Skill) => void;
};

type SkillFormDialogEditProps = SkillFormDialogBaseProps & {
  mode: "edit";
  skill: Skill;
  onUpdated: (skill: Skill) => void;
  onDeleted: (skillId: number) => void;
  canDelete?: boolean;
};

type SkillFormDialogProps = SkillFormDialogCreateProps | SkillFormDialogEditProps;

/** The Skills page's Add skill dialog, and its edit mode (Delete, Revert). */
export default function SkillFormDialog(props: SkillFormDialogProps) {
  const { mode, trigger } = props;
  const skill = props.mode === "edit" ? props.skill : null;
  const { campaignId } = props;
  const dialog = useControllableOpen(props);
  const groups = useSkillGroups(campaignId);
  const groupIdsOf = useCallback(
    (skillId: number) => groupsOf(groups, skillId).map((group) => group.id),
    [groups]
  );
  const form = useSkillForm({
    campaignId,
    skill,
    groupIdsOf,
    resetKey: dialog.open,
    onSaved: (saved) => (props.mode === "create" ? props.onCreated(saved) : props.onUpdated(saved)),
    onDeleted: props.mode === "edit" ? props.onDeleted : undefined,
  });
  const { load } = form;

  useEffect(() => {
    if (dialog.open) {
      load(skill);
    }
  }, [dialog.open, load, skill]);

  return (
    <CatalogueFormDialog
      form={form}
      dialog={dialog}
      editing={skill}
      title={mode === "create" ? "Add Skill" : "Edit Skill"}
      noun="skill"
      trigger={trigger}
      defaultTrigger={
        mode === "create" ? <Button>Add skill</Button> : editEntryTrigger("Edit skill")
      }
      submitLabel={mode === "create" ? "Add skill" : "Save changes"}
      canDelete={props.mode === "edit" && props.canDelete}
      onReset={() => load(skill)}
    >
      <SkillFormFields
        layout="dialog"
        form={form}
        groups={groups}
        idSuffix={skill ? `-${skill.id}` : ""}
      />
    </CatalogueFormDialog>
  );
}
