import { Button } from "@components/button";
import { FieldError } from "@components/field-error";
import { Input } from "@components/input";
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";
import { X } from "lucide-react";

import {
  CatalogueField,
  INLINE_GRID_CLASS,
  fieldId,
  type FormLayout,
} from "@/features/catalogue/components/form-layout";

import type { ItemFormState } from "../hooks/useItemForm";

type ItemAvailabilityFieldsProps = {
  layout: FormLayout;
  form: ItemFormState;
  idSuffix: string;
};

const RARITY_HINT = {
  inline: <span className="text-[10px] text-muted-foreground">(2 for common)</span>,
  dialog: <span className="text-xs text-muted-foreground">(Common = 2)</span>,
};

/** An item's availabilities: each one's price, rarity and variable cost, added and removed. */
export default function ItemAvailabilityFields({
  layout,
  form,
  idSuffix,
}: ItemAvailabilityFieldsProps) {
  const isDialog = layout === "dialog";
  const rows = form.values.availabilities;
  const removeButton = (index: number) => (
    <button
      type="button"
      onClick={() => form.removeAvailability(index)}
      className="text-muted-foreground hover:text-foreground"
      aria-label={isDialog ? undefined : "Remove availability"}
    >
      <X className="h-4 w-4" />
    </button>
  );

  return (
    <div className={isDialog ? "space-y-3" : "space-y-2"}>
      <div className="flex items-center justify-between">
        {isDialog ? (
          <Label>Availabilities</Label>
        ) : (
          <label className="block text-xs text-muted-foreground">Availabilities</label>
        )}
        <Button
          type="button"
          variant={isDialog ? "secondary" : undefined}
          size="sm"
          onClick={form.addAvailability}
        >
          {isDialog ? "Add" : "+ Add"}
        </Button>
      </div>
      {isDialog ? null : <FieldError message={form.fieldErrors.availabilities} />}
      {rows.map((row, index) => {
        const price = (
          <CatalogueField layout={layout} label="Price" htmlFor={`item-cost${idSuffix}-${index}`}>
            <NumberInput
              id={fieldId(layout, `item-cost${idSuffix}-${index}`)}
              min={0}
              step={1}
              value={row.cost}
              onChange={(event) => form.setAvailability(index, "cost", event.target.value)}
              aria-invalid={Boolean(form.rowError(index, "cost"))}
              placeholder="25"
            />
            <FieldError message={form.rowError(index, "cost")} />
          </CatalogueField>
        );
        const rarity = (
          <CatalogueField
            layout={layout}
            label={<>Rarity {RARITY_HINT[layout]}</>}
            htmlFor={`item-rarity${idSuffix}-${index}`}
          >
            <NumberInput
              id={fieldId(layout, `item-rarity${idSuffix}-${index}`)}
              min={2}
              max={20}
              step={1}
              value={row.rarity}
              onChange={(event) => form.setAvailability(index, "rarity", event.target.value)}
              aria-invalid={Boolean(form.rowError(index, "rarity"))}
              placeholder="2"
            />
            <FieldError message={form.rowError(index, "rarity")} />
          </CatalogueField>
        );
        const variableCost = (
          <CatalogueField
            layout={layout}
            label="Variable cost"
            htmlFor={`item-variable${idSuffix}-${index}`}
          >
            <Input
              id={fieldId(layout, `item-variable${idSuffix}-${index}`)}
              value={row.variableCost}
              onChange={(event) => form.setAvailability(index, "variableCost", event.target.value)}
              placeholder="+2d6"
            />
          </CatalogueField>
        );

        return isDialog ? (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-input/80 bg-background/40 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {rows.length > 1 ? `Availability ${index + 1}` : "Availability"}
              </span>
              {rows.length > 1 && removeButton(index)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {price}
              {rarity}
            </div>
            {variableCost}
          </div>
        ) : (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-border/40 bg-background/40 p-3"
          >
            <div className={INLINE_GRID_CLASS}>
              {price}
              {rarity}
              {variableCost}
              {rows.length > 1 && <div className="flex items-end pb-1">{removeButton(index)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
