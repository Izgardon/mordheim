import { CatalogueTypeField } from "@/features/catalogue/components/CatalogueTypeField";
import {
  CatalogueDescriptionField,
  CatalogueNameField,
  INLINE_GRID_CLASS,
  type FormLayout,
} from "@/features/catalogue/components/form-layout";

import type { SpecialFormState } from "../hooks/useSpecialForm";

const CATEGORY_COPY = {
  label: "Category (Injury, Mutation etc)",
  placeholder: "Search or add a special",
  actionLabel: "Add category",
  actionAriaLabel: "Add custom category",
};

type SpecialFormFieldsProps = {
  layout: FormLayout;
  form: SpecialFormState;
};

/** A special's name, category and description. */
export default function SpecialFormFields({ layout, form }: SpecialFormFieldsProps) {
  const isDialog = layout === "dialog";
  const fields = (
    <>
      <CatalogueNameField
        layout={layout}
        id="special-name"
        value={form.values.name}
        onChange={(value) => form.setValue("name", value)}
        error={form.fieldErrors.name}
        nameTaken={form.nameTaken}
        placeholder="Blessing"
        required={isDialog}
      />
      <CatalogueTypeField
        layout={layout}
        id="special-type"
        copy={CATEGORY_COPY}
        field={form.typeField}
      />
      <CatalogueDescriptionField
        layout={layout}
        id="special-description"
        value={form.values.description}
        onChange={(value) => form.setValue("description", value)}
        placeholder="Describe the entry."
        className={isDialog ? undefined : "sm:col-span-2"}
      />
    </>
  );
  return isDialog ? fields : <div className={INLINE_GRID_CLASS}>{fields}</div>;
}
