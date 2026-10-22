import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import { Button } from "@components/button";
import { FieldError } from "@components/field-error";
import { Input } from "@components/input";
import { Label } from "@components/label";
import { X } from "lucide-react";

import {
  CatalogueField,
  INLINE_GRID_CLASS,
  fieldId,
  type FormLayout,
} from "@/features/catalogue/components/form-layout";

import type { ItemPropertyPicker } from "../hooks/useItemPropertyPicker";

const NEW_DESCRIPTION_CLASS =
  "min-h-[80px] w-full rounded-2xl border border-input/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] placeholder:text-muted-foreground/60 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]";

type ItemPropertyFieldProps = {
  layout: FormLayout;
  picker: ItemPropertyPicker;
  /** The server's refusal of the chosen properties. */
  error?: string;
  idSuffix: string;
};

/** An item's Properties: search the type's, create one on the spot, and the chosen chips. */
export default function ItemPropertyField({
  layout,
  picker,
  error,
  idSuffix,
}: ItemPropertyFieldProps) {
  const isDialog = layout === "dialog";
  const nameId = `new-property-name${idSuffix}`;
  const descriptionId = `new-property-description${idSuffix}`;
  const newPropertyFields = (
    <>
      <CatalogueField layout={layout} label="Property name" htmlFor={nameId}>
        <Input
          id={fieldId(layout, nameId)}
          value={picker.newName}
          onChange={(event) => picker.setNewName(event.target.value)}
          placeholder="Battle Schooled"
        />
      </CatalogueField>
      <CatalogueField
        layout={layout}
        label="Description"
        htmlFor={descriptionId}
        className={isDialog ? undefined : "sm:col-span-1 lg:col-span-3"}
      >
        {isDialog ? (
          <textarea
            id={descriptionId}
            value={picker.newDescription}
            onChange={(event) => picker.setNewDescription(event.target.value)}
            placeholder="Describe this property..."
            className={NEW_DESCRIPTION_CLASS}
          />
        ) : (
          <Input
            value={picker.newDescription}
            onChange={(event) => picker.setNewDescription(event.target.value)}
            placeholder="Describe this property..."
          />
        )}
      </CatalogueField>
    </>
  );

  return (
    <div className={isDialog ? "space-y-3" : "space-y-2"}>
      {isDialog ? (
        <Label>Properties</Label>
      ) : (
        <label className="block text-xs text-muted-foreground">Properties</label>
      )}
      <ActionSearchInput
        placeholder="Search properties..."
        value={picker.search}
        onChange={(event) => picker.setSearch(event.target.value)}
        onAction={picker.toggleCreate}
        actionLabel="Create"
      >
        <ActionSearchDropdown
          open={picker.search.length > 0 && picker.hasMatches}
          onClose={() => picker.setSearch("")}
          className="rounded-lg border-input/80"
        >
          <div className="max-h-40 overflow-y-auto">
            {picker.suggestions.map((property) => (
              <button
                key={property.id}
                type="button"
                onClick={() => picker.choose(property)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent/50"
                title={property.description}
              >
                {property.name}
              </button>
            ))}
          </div>
        </ActionSearchDropdown>
      </ActionSearchInput>
      <FieldError message={error} />
      {picker.isCreateOpen && (
        <div
          className={
            isDialog
              ? "space-y-3 rounded-lg border border-input/80 bg-background/40 p-4"
              : "space-y-2 rounded-lg border border-input/80 bg-background/40 p-3"
          }
        >
          {isDialog ? (
            newPropertyFields
          ) : (
            <div className={INLINE_GRID_CLASS}>{newPropertyFields}</div>
          )}
          <Button
            onClick={picker.create}
            disabled={picker.isCreating || !picker.newName.trim()}
            size="sm"
          >
            {picker.isCreating ? "Creating..." : "Add property"}
          </Button>
        </div>
      )}
      {picker.selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picker.selected.map((property) => (
            <div
              key={property.id}
              className="group relative inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm"
              title={property.description}
            >
              <span>{property.name}</span>
              <button
                type="button"
                onClick={() => picker.drop(property.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
