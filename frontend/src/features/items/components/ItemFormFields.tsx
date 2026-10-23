import { Checkbox } from "@components/checkbox";
import { Input } from "@components/input";
import { Label } from "@components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";

import {
  CatalogueField,
  CatalogueNameField,
  INLINE_GRID_CLASS,
  TEXTAREA_CLASS,
  fieldId,
  type FormLayout,
} from "@/features/catalogue/components/form-layout";
import { STAT_LABELS } from "@/features/catalogue/utils/statblock";

import { hasSubtype } from "../utils/item-form-values";
import ItemAvailabilityFields from "./ItemAvailabilityFields";
import ItemPropertyField from "./ItemPropertyField";

import type { ItemFormState } from "../hooks/useItemForm";

type ItemFormFieldsProps = {
  layout: FormLayout;
  form: ItemFormState;
  /** The dialog's ids say which mode it is in ("-create"); the page's form has none. */
  idSuffix?: string;
};

/**
 * An item's fields, inline on the Wargear page (short fields in a grid, then the rest) or in
 * the warband pages' dialog (one column, in the dialog's order).
 */
export default function ItemFormFields({ layout, form, idSuffix = "" }: ItemFormFieldsProps) {
  const isDialog = layout === "dialog";
  const { values } = form;
  const id = (name: string) => `item-${name}${idSuffix}`;
  const options = (list: string[]) =>
    list.map((option) => (
      <SelectItem key={option} value={option}>
        {option}
      </SelectItem>
    ));
  const textField = (field: "strength" | "range" | "save", label: string, placeholder: string) => (
    <CatalogueField layout={layout} label={label} htmlFor={id(field)}>
      <Input
        id={fieldId(layout, id(field))}
        value={values[field]}
        onChange={(event) => form.setValue(field, event.target.value)}
        placeholder={placeholder}
      />
    </CatalogueField>
  );

  const name = (
    <CatalogueNameField
      layout={layout}
      id={id("name")}
      value={values.name}
      onChange={(value) => form.setValue("name", value)}
      error={form.fieldErrors.name}
      nameTaken={form.nameTaken}
      placeholder="Gutterblade"
    />
  );
  const type = (
    <CatalogueField layout={layout} label="Type" htmlFor={id("type")}>
      <Select value={values.type} onValueChange={form.setType}>
        <SelectTrigger id={fieldId(layout, id("type"))}>
          <SelectValue placeholder="Select a type" />
        </SelectTrigger>
        <SelectContent>{options(form.typeOptions)}</SelectContent>
      </Select>
    </CatalogueField>
  );
  const subtype = hasSubtype(values.type) ? (
    <CatalogueField layout={layout} label="Subtype" htmlFor={id("subtype")}>
      <Select value={values.subtype} onValueChange={(value) => form.setValue("subtype", value)}>
        <SelectTrigger id={fieldId(layout, id("subtype"))}>
          <SelectValue placeholder="Select a subtype" />
        </SelectTrigger>
        <SelectContent>{options(form.subtypeOptions)}</SelectContent>
      </Select>
    </CatalogueField>
  ) : null;
  const weapon =
    values.type === "Weapon" ? (
      <>
        {textField("strength", "Strength", "As user")}
        {textField("range", "Range", "Close combat or 6/12")}
      </>
    ) : null;
  const armour = values.type === "Armour" ? textField("save", "Save", "6+") : null;
  const statblock =
    values.type === "Animal" ? (
      <CatalogueField layout={layout} label="Statblock">
        <div className={`grid grid-cols-3 sm:grid-cols-9 ${isDialog ? "gap-3" : "gap-2"}`}>
          {STAT_LABELS.map((label) => (
            <div key={label} className={isDialog ? "space-y-1" : undefined}>
              <Label
                htmlFor={fieldId(layout, `item-stat${idSuffix}-${label}`)}
                className={
                  isDialog
                    ? "text-xs uppercase tracking-[0.2em]"
                    : "text-[10px] uppercase tracking-[0.2em]"
                }
              >
                {label}
              </Label>
              <Input
                id={fieldId(layout, `item-stat${idSuffix}-${label}`)}
                value={values.statblock[label]}
                onChange={(event) => form.setStat(label, event.target.value)}
                className="h-9 px-2 text-center text-xs"
              />
            </div>
          ))}
        </div>
      </CatalogueField>
    ) : null;
  const singleUse =
    values.type === "Miscellaneous" ? (
      <div className={isDialog ? "flex items-center gap-2" : "flex items-end gap-2 pb-2"}>
        <Checkbox
          id={`item-single-use${idSuffix}`}
          checked={values.singleUse}
          onChange={(event) => form.setSingleUse(event.target.checked)}
        />
        <Label htmlFor={`item-single-use${idSuffix}`}>Single use</Label>
      </div>
    ) : null;
  const properties = values.type ? (
    <ItemPropertyField
      layout={layout}
      picker={form.properties}
      error={form.fieldErrors.property_ids}
      idSuffix={idSuffix}
    />
  ) : null;
  const fluff = (
    <>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`add-fluff-toggle${idSuffix}`}
          checked={form.showFluff}
          onChange={(event) => form.setShowFluff(event.target.checked)}
        />
        <Label htmlFor={`add-fluff-toggle${idSuffix}`}>Add fluff</Label>
      </div>
      {form.showFluff ? (
        <textarea
          id={fieldId(layout, id("description"))}
          value={values.description}
          onChange={(event) => form.setValue("description", event.target.value)}
          placeholder="Describe the item."
          rows={isDialog ? undefined : 2}
          className={TEXTAREA_CLASS[layout]}
        />
      ) : null}
    </>
  );
  const availabilities = <ItemAvailabilityFields layout={layout} form={form} idSuffix={idSuffix} />;

  if (isDialog) {
    return (
      <>
        {name}
        {type}
        {subtype}
        {properties}
        {fluff}
        {weapon ? <div className="grid gap-4 sm:grid-cols-2">{weapon}</div> : null}
        {armour}
        {statblock}
        {singleUse}
        {availabilities}
      </>
    );
  }
  return (
    <>
      <div className={INLINE_GRID_CLASS}>
        {name}
        {type}
        {subtype}
        {weapon}
        {armour}
      </div>
      {statblock}
      {availabilities}
      {singleUse}
      {properties}
      {fluff}
    </>
  );
}
