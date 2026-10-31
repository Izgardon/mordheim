import { CatalogueTypeField } from "@/features/catalogue/components/CatalogueTypeField";
import { Input } from "@/components/ui/input";
import {
  CatalogueDescriptionField,
  CatalogueField,
  CatalogueNameField,
  INLINE_GRID_CLASS,
  fieldId,
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

/**
 * A skill's name, list and description, inline on the Skills page or in a dialog, and who learns it:
 * a Large unit's skill (the pages warn for any other unit) and a note shown when learning it.
 */
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
      <CatalogueField
        layout={layout}
        label="Note when learning"
        htmlFor={fieldId(layout, `skill-learn-note${idSuffix}`)}
      >
        <Input
          id={fieldId(layout, `skill-learn-note${idSuffix}`)}
          value={form.values.learn_note}
          maxLength={200}
          placeholder="e.g. Vampire only"
          onChange={(event) => form.setLearning({ learn_note: event.target.value })}
        />
      </CatalogueField>
      <label className="flex items-center gap-2 self-end text-sm text-ink">
        <input
          type="checkbox"
          checked={form.values.large_only}
          onChange={(event) => form.setLearning({ large_only: event.target.checked })}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        Large units only
      </label>
    </>
  );
  return isDialog ? fields : <div className={INLINE_GRID_CLASS}>{fields}</div>;
}
