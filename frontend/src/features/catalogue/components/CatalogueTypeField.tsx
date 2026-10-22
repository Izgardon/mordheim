import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";

import { CatalogueField, fieldId, type FormLayout } from "./form-layout";
import type { CatalogueTypeFieldState } from "../hooks/useCatalogueTypeField";

/** The words of one kind's type box: "List" for skills, "Class" for spells, and so on. */
export type TypeFieldCopy = {
  label: string;
  placeholder: string;
  actionLabel: string;
  actionAriaLabel: string;
};

type CatalogueTypeFieldProps = {
  layout: FormLayout;
  id: string;
  copy: TypeFieldCopy;
  field: CatalogueTypeFieldState;
};

const formatTypeLabel = (value: string) => value.replace(/_/g, " ");

/** The type box the skill, spell and special forms share: search the types, or add one. */
export function CatalogueTypeField({ layout, id, copy, field }: CatalogueTypeFieldProps) {
  return (
    <CatalogueField
      layout={layout}
      label={copy.label}
      htmlFor={id}
      className="relative"
      onFocusCapture={field.openMenu}
      onBlurCapture={field.handleBlur}
    >
      <ActionSearchInput
        id={fieldId(layout, id)}
        value={field.value}
        onChange={(event) => field.type(event.target.value)}
        placeholder={copy.placeholder}
        actionLabel={copy.actionLabel}
        actionAriaLabel={copy.actionAriaLabel}
        actionDisabled={!field.canAdd}
        onAction={field.add}
        required={layout === "dialog"}
        autoComplete="off"
      >
        <ActionSearchDropdown
          open={field.isMenuOpen}
          onClose={field.closeMenu}
          className="z-50 rounded-2xl"
        >
          {field.options.length > 0 ? (
            <div className="max-h-40 w-full overflow-y-auto p-2 text-sm">
              <div className="space-y-1">
                {field.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => field.select(option)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-accent/30"
                  >
                    <span className="font-medium">{formatTypeLabel(option)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full px-3 py-2 text-xs text-muted-foreground">
              No matching types yet.
            </div>
          )}
        </ActionSearchDropdown>
      </ActionSearchInput>
    </CatalogueField>
  );
}
