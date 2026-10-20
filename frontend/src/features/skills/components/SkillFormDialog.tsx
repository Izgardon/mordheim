import { useEffect } from "react";
import type { ReactNode } from "react";

import { Button } from "@components/button";

import {
  CatalogueFormDialog,
  editEntryTrigger,
} from "@/features/catalogue/components/CatalogueFormDialog";
import { useControllableOpen } from "@/features/catalogue/hooks/useControllableOpen";

import { useSkillForm } from "../hooks/useSkillForm";
import SkillFormFields from "./SkillFormFields";

import type { Skill } from "../types/skill-types";

type SkillFormDialogBaseProps = {
  typeOptions?: string[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type SkillFormDialogCreateProps = SkillFormDialogBaseProps & {
  mode: "create";
  campaignId: number;
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

/** The warband pages' New skill dialog (and an edit mode, with Delete). */
export default function SkillFormDialog(props: SkillFormDialogProps) {
  const { mode, typeOptions = [], trigger } = props;
  const skill = props.mode === "edit" ? props.skill : null;
  const campaignId = props.mode === "create" ? props.campaignId : (skill?.campaign_id ?? NaN);
  const dialog = useControllableOpen(props);
  const form = useSkillForm({
    campaignId,
    skill,
    typeOptions,
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
      <SkillFormFields layout="dialog" form={form} idSuffix={skill ? `-${skill.id}` : ""} />
    </CatalogueFormDialog>
  );
}
