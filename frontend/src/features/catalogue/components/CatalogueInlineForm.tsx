import type { ReactNode } from "react";

import { Button } from "@components/button";

import { CatalogueDeleteConfirm } from "./CatalogueDeleteConfirm";
import { RevertButton, RevertConfirm, RuleVersionNote, canRevert } from "./CatalogueVersionActions";
import { entrySource } from "../utils/entry-status";
import type { CatalogueEntryLike } from "../types/catalogue-entry";
import type { CatalogueFormState } from "../types/catalogue-form";

type CatalogueInlineFormProps = {
  form: CatalogueFormState;
  /** The entry being edited (Save changes, Revert or Delete); none when adding. */
  editing: CatalogueEntryLike | null | undefined;
  /** "item", "skill", "spell": the confirm reads "Delete item". */
  noun: string;
  canDelete: boolean;
  /** Back to a blank form: after a save, a delete, a Revert or Cancel. */
  onReset: () => void;
  onCancel: () => void;
  /** The kind's fields. */
  children: ReactNode;
};

/**
 * A catalogue page's Add or Edit form: the fields, the line under them, Delete (the campaign's own
 * entries) or Revert (its versions of book entries; a rule's clone says which rule set it), Cancel
 * and Save.
 */
export function CatalogueInlineForm({
  form,
  editing,
  noun,
  canDelete,
  onReset,
  onCancel,
  children,
}: CatalogueInlineFormProps) {
  const { deleteConfirm, remove, revert } = form;
  const offersDelete = Boolean(
    editing && canDelete && deleteConfirm && remove && entrySource(editing) === "custom"
  );
  const offersRevert = Boolean(editing && revert && canRevert(editing));
  return (
    <div className="space-y-3 border border-border/60 bg-background/80 p-4">
      {children}
      {form.formError && <p className="text-sm text-red-600">{form.formError}</p>}
      {editing?.generated_effect_key && revert ? (
        <RuleVersionNote effectKey={editing.generated_effect_key} campaignId={revert.campaignId} />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {offersDelete && deleteConfirm ? (
          <Button
            variant="destructive"
            onClick={deleteConfirm.open}
            disabled={form.isSaving}
            size="sm"
          >
            Delete
          </Button>
        ) : null}
        {offersRevert && revert ? <RevertButton revert={revert} disabled={form.isSaving} /> : null}
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
            {form.isSaving ? "Saving..." : editing ? "Save changes" : "Save"}
          </Button>
        </div>
      </div>
      {editing && offersDelete && deleteConfirm && remove ? (
        <CatalogueDeleteConfirm
          confirm={deleteConfirm}
          name={editing.name}
          noun={noun}
          isDeleting={form.isSaving}
          onConfirm={() => void remove(onReset)}
        />
      ) : null}
      {editing && offersRevert && revert ? (
        <RevertConfirm revert={revert} entry={editing} onReverted={onReset} />
      ) : null}
    </div>
  );
}
