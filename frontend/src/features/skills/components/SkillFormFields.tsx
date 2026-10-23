import { CatalogueTypeField } from "@/features/catalogue/components/CatalogueTypeField";
import {
  CatalogueDescriptionField,
  CatalogueNameField,
  INLINE_GRID_CLASS,
  type FormLayout,
} from "@/features/catalogue/components/form-layout";

import type { SkillFormState } from "../hooks/useSkillForm";

const LIST_COPY = {
  label: "List",
  placeholder: "Search or add a list",
  actionLabel: "Add list",
  actionAriaLabel: "Add custom list",
};

type SkillFormFieldsProps = {
  layout: FormLayout;
  form: SkillFormState;
  /** Tells the ids of one edited skill's dialog from another's. */
  idSuffix?: string;
};

/** A skill's name, list and description, inline on the Skills page or in a dialog. */
export default function SkillFormFields({ layout, form, idSuffix = "" }: SkillFormFieldsProps) {
  const isDialog = layout === "dialog";
  const fields = (
    <>
      <CatalogueNameField
        layout={layout}
        id={`skill-name${idSuffix}`}
        value={form.values.name}
        onChange={form.setName}
        error={form.fieldErrors.name}
        nameTaken={form.nameTaken}
        placeholder="Quick Hands"
        required={isDialog}
      />
      <CatalogueTypeField
        layout={layout}
        id={`skill-type${idSuffix}`}
        copy={LIST_COPY}
        field={form.typeField}
      />
      <CatalogueDescriptionField
        layout={layout}
        id={`skill-description${idSuffix}`}
        value={form.values.description}
        onChange={form.setDescription}
        placeholder="Describe the skill."
        className={isDialog ? undefined : "sm:col-span-2"}
      />
    </>
  );
  return isDialog ? fields : <div className={INLINE_GRID_CLASS}>{fields}</div>;
}
