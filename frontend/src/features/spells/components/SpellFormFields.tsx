import { NumberInput } from "@components/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";

import { CatalogueTypeField } from "@/features/catalogue/components/CatalogueTypeField";
import {
  CatalogueDescriptionField,
  CatalogueField,
  CatalogueNameField,
  INLINE_GRID_CLASS,
  fieldId,
  type FormLayout,
} from "@/features/catalogue/components/form-layout";

import type { SpellFormState } from "../hooks/useSpellForm";

const CLASS_COPY = {
  label: "Class",
  placeholder: "Search or add a class",
  actionLabel: "Add class",
  actionAriaLabel: "Add custom class",
};

const ROLL_OPTIONS = ["1", "2", "3", "4", "5", "6"] as const;

type SpellFormFieldsProps = {
  layout: FormLayout;
  form: SpellFormState;
};

/** A spell's name, class, difficulty, roll and description, inline or in a dialog. */
export default function SpellFormFields({ layout, form }: SpellFormFieldsProps) {
  const isDialog = layout === "dialog";
  const name = (
    <CatalogueNameField
      layout={layout}
      id="spell-name"
      value={form.values.name}
      onChange={(value) => form.setValue("name", value)}
      error={form.fieldErrors.name}
      nameTaken={form.nameTaken}
      placeholder="Fireball"
      required={isDialog}
    />
  );
  const type = (
    <CatalogueTypeField layout={layout} id="spell-type" copy={CLASS_COPY} field={form.typeField} />
  );
  const difficulty = (
    <CatalogueField layout={layout} label="Difficulty" htmlFor="spell-dc">
      <NumberInput
        id={fieldId(layout, "spell-dc")}
        min={0}
        value={form.values.dc}
        onChange={(event) => form.setValue("dc", event.target.value)}
        placeholder="0"
      />
    </CatalogueField>
  );
  const roll = (
    <CatalogueField layout={layout} label="Roll" htmlFor="spell-roll">
      <Select value={form.values.roll} onValueChange={(value) => form.setValue("roll", value)}>
        <SelectTrigger id={fieldId(layout, "spell-roll")}>
          <SelectValue placeholder="Select roll" />
        </SelectTrigger>
        <SelectContent>
          {ROLL_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </CatalogueField>
  );
  const description = (
    <CatalogueDescriptionField
      layout={layout}
      id="spell-description"
      value={form.values.description}
      onChange={(value) => form.setValue("description", value)}
      placeholder="Describe the spell."
    />
  );

  if (isDialog) {
    return (
      <>
        {name}
        {type}
        <div className="grid grid-cols-2 gap-4">
          {difficulty}
          {roll}
        </div>
        {description}
      </>
    );
  }
  return (
    <>
      <div className={INLINE_GRID_CLASS}>
        {name}
        {type}
        {difficulty}
        {roll}
      </div>
      {description}
    </>
  );
}
