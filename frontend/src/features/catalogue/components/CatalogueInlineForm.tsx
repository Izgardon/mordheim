import type { ReactNode } from "react";

import { Button } from "@components/button";

import { CatalogueDeleteConfirm } from "./CatalogueDeleteConfirm";
import type { CatalogueFormState } from "../types/catalogue-form";

type CatalogueInlineFormProps = {
  form: CatalogueFormState;
  /** The entry being edited (Save changes, and Delete with `canDelete`); none when adding. */
  editing: { name: string } | null | undefined;
  /** "item", "skill", "spell": the confirm reads "Delete item". */
  noun: string;
  canDelete: boolean;
  /** Back to a blank form: after a save, a delete or Cancel. */
  onReset: () => void;
  onCancel: () => void;
  /** The kind's fields. */
  children: ReactNode;
};

/** A catalogue page's Add or Edit form: the fields, the line under them, Delete, Cancel, Save. */
export function CatalogueInlineForm({
  form,
  editing,
  noun,
  canDelete,
  onReset,
  onCancel,
  children,
}: CatalogueInlineFormProps) {
  const isEditing = Boolean(editing);
  return (
    <div className="space-y-3 border border-border/60 bg-background/80 p-4">
      {children}
      {form.formError && <p className="text-sm text-red-600">{form.formError}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {isEditing && canDelete && form.deleteConfirm && (
          <Button
            variant="destructive"
            onClick={form.deleteConfirm.open}
            disabled={form.isSaving}
            size="sm"
          >
            Delete
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              onReset();
              onCancel();
            }}
            disabled={form.isSaving}
            size="sm"
          >
            Cancel
          </Button>
          <Button onClick={() => void form.save(onReset)} disabled={form.isSaving} size="sm">
            {form.isSaving ? "Saving..." : isEditing ? "Save changes" : "Save"}
          </Button>
        </div>
      </div>
      {editing && form.deleteConfirm && form.remove && (
        <CatalogueDeleteConfirm
          confirm={form.deleteConfirm}
          name={editing.name}
          noun={noun}
          isDeleting={form.isSaving}
          onConfirm={() => void form.remove?.(onReset)}
        />
      )}
    </div>
  );
}
