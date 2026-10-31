import { Checkbox } from "@components/checkbox";
import { Input } from "@components/input";
import { Label } from "@components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";

import {
  CatalogueField,
  CatalogueNameField,
  TEXTAREA,
} from "@/features/catalogue/components/form-layout";

import { hasSubtype, type ItemTextField } from "../utils/item-form-values";
import PriceRowsField from "./PriceRowsField";
import RulesField from "./RulesField";

import type { ItemFormState } from "../hooks/useItemForm";

type ItemFormFieldsProps = {
  form: ItemFormState;
  /** The dialog's ids say which mode it is in ("-create"). */
  idSuffix?: string;
};

/**
 * A house item's fields (the items rebuild): name, variant, type and figures; its flavour; its
 * rules, shared or its own, with D6 tables; its price rows with who may buy each; and where it
 * comes from (source, link, search words, notes).
 */
export default function ItemFormFields({ form, idSuffix = "" }: ItemFormFieldsProps) {
  const { values } = form;
  const id = (name: string) => `item-${name}${idSuffix}`;
  const options = (list: string[]) =>
    list.map((option) => (
      <SelectItem key={option} value={option}>
        {option}
      </SelectItem>
    ));
  const text = (field: ItemTextField, label: string, placeholder: string) => (
    <CatalogueField layout="dialog" label={label} htmlFor={id(field)}>
      <Input
        id={id(field)}
        value={values[field]}
        onChange={(event) => form.setValue(field, event.target.value)}
        placeholder={placeholder}
      />
    </CatalogueField>
  );
  const longText = (field: "flavour" | "notes", label: string, placeholder: string) => (
    <CatalogueField layout="dialog" label={label} htmlFor={id(field)}>
      <textarea
        id={id(field)}
        value={values[field]}
        onChange={(event) => form.setValue(field, event.target.value)}
        placeholder={placeholder}
        className={TEXTAREA.replace("min-h-[120px]", "min-h-[80px]")}
      />
    </CatalogueField>
  );

  return (
    <>
      <CatalogueNameField
        layout="dialog"
        id={id("name")}
        value={values.name}
        onChange={(value) => form.setValue("name", value)}
        error={form.fieldErrors.name}
        nameTaken={form.nameTaken}
        placeholder="Gutterblade"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CatalogueField layout="dialog" label="Type" htmlFor={id("type")}>
          <Select value={values.type} onValueChange={form.setType}>
            <SelectTrigger id={id("type")}>
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>{options(form.typeOptions)}</SelectContent>
          </Select>
        </CatalogueField>
        {hasSubtype(values.type) ? (
          <CatalogueField layout="dialog" label="Subtype" htmlFor={id("subtype")}>
            <Select
              value={values.subtype}
              onValueChange={(value) => form.setValue("subtype", value)}
            >
              <SelectTrigger id={id("subtype")}>
                <SelectValue placeholder="Select a subtype" />
              </SelectTrigger>
              <SelectContent>{options(form.subtypeOptions)}</SelectContent>
            </Select>
          </CatalogueField>
        ) : (
          text("variant", "Variant (optional)", "Tells two of one name apart")
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {values.type === "Weapon" ? text("range", "Range", 'Close combat or 24"') : null}
        {values.type === "Weapon" ? text("strength", "Strength", "As user") : null}
        {values.type === "Armour" ? text("save", "Save", "6+") : null}
      </div>
      {values.type === "Miscellaneous" ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`item-single-use${idSuffix}`}
            checked={values.singleUse}
            onChange={(event) => form.setSingleUse(event.target.checked)}
          />
          <Label htmlFor={`item-single-use${idSuffix}`}>Single use</Label>
        </div>
      ) : null}
      {longText("flavour", "Flavour", "What it looks like and where it comes from.")}
      <RulesField
        rules={values.rules}
        shared={form.shared}
        onChange={form.setRules}
        errorOf={form.errorOf}
        idPrefix={`item-rule${idSuffix}`}
      />
      <PriceRowsField
        campaignId={form.campaignId}
        rows={values.prices}
        onChange={form.setPrices}
        errorOf={form.errorOf}
        path="availabilities"
        idPrefix={`item-price${idSuffix}`}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {text("source", "Source", "Town Cryer #6")}
        {text("linkUrl", "Link", "https://…")}
      </div>
      {text("tags", "Search words", "scimitar, blade")}
      {longText("notes", "Notes", "Anything an editor should know.")}
    </>
  );
}
