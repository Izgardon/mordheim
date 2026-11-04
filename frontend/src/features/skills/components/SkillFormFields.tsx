import { SearchMultiSelect, type SearchOption } from "@/components/ui/search-select";
import {
  CatalogueDescriptionField,
  CatalogueField,
  CatalogueNameField,
  INLINE_GRID_CLASS,
  fieldId,
  type FormLayout,
} from "@/features/catalogue/components/form-layout";

import type { SkillGroupIndex } from "../skill-groups";
import type { SkillFormState } from "../hooks/useSkillForm";

type SkillFormFieldsProps = {
  layout: FormLayout;
  form: SkillFormState;
  /** The campaign's skill groups, to pick the ones holding it. */
  groups: SkillGroupIndex;
  /** Tells the ids of one edited skill's dialog from another's. */
  idSuffix?: string;
};

/** A skill's name, groups and description, inline on the Skills page or in a dialog. */
export default function SkillFormFields({
  layout,
  form,
  groups,
  idSuffix = "",
}: SkillFormFieldsProps) {
  const isDialog = layout === "dialog";
  const option = (id: number): SearchOption => ({
    id,
    title: groups.byId.get(id)?.name ?? "",
  });
  const fields = (
    <>
      <CatalogueNameField
        layout={layout}
        id={`skill-name${idSuffix}`}
        value={form.values.name}
        onChange={form.setName}
        error={form.fieldErrors.name}
        nameTaken={form.nameTaken}
        placeholder="Skill name"
        required={isDialog}
      />
      <CatalogueField
        layout={layout}
        label="Groups"
        htmlFor={fieldId(layout, `skill-groups${idSuffix}`)}
      >
        <SearchMultiSelect
          id={fieldId(layout, `skill-groups${idSuffix}`)}
          addLabel="Add a group"
          placeholder="Search skill groups"
          emptyText="No skill group matches."
          options={groups.groups.map((group) => option(group.id))}
          values={form.values.groupIds.filter((id) => groups.byId.has(id)).map(option)}
          onChange={(next) => form.setGroupIds(next.map((picked) => Number(picked.id)))}
        />
      </CatalogueField>
      <CatalogueDescriptionField
        layout={layout}
        id={`skill-description${idSuffix}`}
        value={form.values.description}
        onChange={form.setDescription}
        className={isDialog ? undefined : "sm:col-span-2"}
      />
    </>
  );
  return isDialog ? fields : <div className={INLINE_GRID_CLASS}>{fields}</div>;
}
