import { useEffect } from "react";
import type { ReactNode } from "react";

import { CheckboxField } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SearchMultiSelect, type SearchOption } from "@/components/ui/search-select";
import {
  CatalogueFormDialog,
  editEntryTrigger,
} from "@/features/catalogue/components/CatalogueFormDialog";
import {
  CatalogueField,
  CatalogueNameField,
  fieldId,
} from "@/features/catalogue/components/form-layout";
import WhoCanField from "@/features/catalogue/components/WhoCanField";
import { useControllableOpen } from "@/features/catalogue/hooks/useControllableOpen";
import { useCatalogue } from "@/lib/catalogue-queries";

import { useSkillGroupForm } from "../hooks/useSkillGroupForm";

import type { SkillGroup } from "../types/skill-types";

type SkillGroupFormDialogProps = {
  campaignId: number;
  /** The group to edit; null adds one. */
  group: SkillGroup | null;
  canDelete?: boolean;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: (group: SkillGroup) => void;
  onDeleted?: (groupId: number) => void;
};

/**
 * Add or Edit a skill group (skill groups, phase 1a): its name, who learns from it (the who-can
 * editor), Large units only, the note shown when learning from it, and its skills; Delete, or
 * Revert to book for a campaign's version.
 */
export default function SkillGroupFormDialog(props: SkillGroupFormDialogProps) {
  const { campaignId, group } = props;
  const dialog = useControllableOpen(props);
  const skills = useCatalogue("skills", campaignId, { enabled: dialog.open }).data;
  const form = useSkillGroupForm({
    campaignId,
    group,
    resetKey: dialog.open,
    onSaved: props.onSaved,
    onDeleted: props.onDeleted,
  });
  const { load } = form;
  const suffix = group ? `-${group.id}` : "";

  useEffect(() => {
    if (dialog.open) load(group);
  }, [dialog.open, group, load]);

  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const option = (id: number): SearchOption => ({ id, title: byId.get(id)?.name ?? "" });
  return (
    <CatalogueFormDialog
      form={form}
      dialog={dialog}
      editing={group}
      title={group ? "Edit Skill Group" : "Add Skill Group"}
      noun="skill group"
      trigger={props.trigger}
      defaultTrigger={editEntryTrigger("Edit skill group")}
      submitLabel={group ? "Save changes" : "Add skill group"}
      canDelete={Boolean(group && props.canDelete)}
      onReset={() => load(group)}
    >
      <CatalogueNameField
        layout="dialog"
        id={`skill-group-name${suffix}`}
        value={form.values.name}
        onChange={(name) => form.set("name", name)}
        error={form.fieldErrors.name}
        nameTaken={form.nameTaken}
        placeholder="Skill group name"
        required
      />
      <WhoCanField
        campaignId={campaignId}
        id={`skill-group-who${suffix}`}
        label="Who learns from it"
        value={form.values.who}
        onChange={(who) => form.set("who", who)}
      />
      <CheckboxField
        checked={form.values.large_only}
        onChange={(event) => form.set("large_only", event.target.checked)}
      >
        Large units only
      </CheckboxField>
      <CatalogueField
        layout="dialog"
        label="Note when learning"
        htmlFor={fieldId("dialog", `skill-group-note${suffix}`)}
      >
        <Input
          id={fieldId("dialog", `skill-group-note${suffix}`)}
          value={form.values.learn_note}
          maxLength={200}
          onChange={(event) => form.set("learn_note", event.target.value)}
        />
      </CatalogueField>
      <CatalogueField
        layout="dialog"
        label="Skills"
        htmlFor={fieldId("dialog", `skill-group-skills${suffix}`)}
      >
        <SearchMultiSelect
          id={fieldId("dialog", `skill-group-skills${suffix}`)}
          addLabel="Add a skill"
          placeholder="Search skills"
          emptyText="No skill matches."
          options={skills.map((skill) => option(skill.id))}
          values={form.values.skillIds.filter((id) => byId.has(id)).map(option)}
          onChange={(next) =>
            form.set(
              "skillIds",
              next.map((picked) => Number(picked.id))
            )
          }
        />
      </CatalogueField>
    </CatalogueFormDialog>
  );
}
