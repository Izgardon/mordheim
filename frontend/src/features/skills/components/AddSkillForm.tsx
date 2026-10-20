import { useEffect } from "react";

import { CatalogueInlineForm } from "@/features/catalogue/components/CatalogueInlineForm";

import { useSkillForm } from "../hooks/useSkillForm";
import SkillFormFields from "./SkillFormFields";

import type { Skill } from "../types/skill-types";

type AddSkillFormProps = {
  campaignId: number;
  onCreated: (skill: Skill) => void;
  onUpdated?: (skill: Skill) => void;
  onDeleted?: (skillId: number) => void;
  onCancel: () => void;
  typeOptions?: string[];
  editingSkill?: Skill | null;
  canDelete?: boolean;
};

/** The Skills page's Add skill and Edit form. */
export default function AddSkillForm({
  campaignId,
  onCreated,
  onUpdated,
  onDeleted,
  onCancel,
  typeOptions = [],
  editingSkill,
  canDelete = false,
}: AddSkillFormProps) {
  const skill = editingSkill ?? null;
  const form = useSkillForm({
    campaignId,
    skill,
    typeOptions,
    resetKey: editingSkill,
    onSaved: (saved) => (skill ? onUpdated?.(saved) : onCreated(saved)),
    onDeleted,
  });
  const { load } = form;

  useEffect(() => load(skill), [load, skill]);

  return (
    <CatalogueInlineForm
      form={form}
      editing={skill}
      noun="skill"
      canDelete={canDelete}
      onReset={() => load(null)}
      onCancel={onCancel}
    >
      <SkillFormFields layout="inline" form={form} />
    </CatalogueInlineForm>
  );
}
