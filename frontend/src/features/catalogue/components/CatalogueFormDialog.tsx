import type { ReactNode } from "react";

import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
import { Tooltip } from "@components/tooltip";
import { useDiscardChanges } from "@/components/ui/discard-changes";
import { Pencil } from "lucide-react";

import { CatalogueDeleteConfirm } from "./CatalogueDeleteConfirm";
import { RevertButton, RevertConfirm, RuleVersionNote, canRevert } from "./CatalogueVersionActions";
import { entrySource } from "../utils/entry-status";
import type { ControllableOpen } from "../hooks/useControllableOpen";
import type { CatalogueEntryLike } from "../types/catalogue-entry";
import type { CatalogueFormState } from "../types/catalogue-form";

type CatalogueFormDialogProps = {
  form: CatalogueFormState;
  dialog: ControllableOpen;
  /** The entry being edited (Delete with `canDelete`, or Revert); none when adding. */
  editing?: CatalogueEntryLike | null;
  title: string;
  /** Beside the title (the item form's Simple / Advanced). */
  headerAside?: ReactNode;
  /** "item", "skill": the confirm reads "Delete item" (a kind that can be edited). */
  noun?: string;
  /** The caller's trigger, none (`null`), or the default one (`undefined`). */
  trigger: ReactNode | null | undefined;
  defaultTrigger: ReactNode;
  submitLabel: string;
  canDelete?: boolean;
  /** Back to the form's starting point: after Cancel, closing, or a save. */
  onReset: () => void;
  /** The kind's fields. */
  children: ReactNode;
};

/** The pencil that opens a catalogue form dialog in edit mode (an element, for DialogTrigger). */
export function editEntryTrigger(label: string) {
  return (
    <Tooltip
      trigger={
        <button
          type="button"
          aria-label={label}
          className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-head"
        >
          <Pencil className="h-5 w-5" aria-hidden="true" />
        </button>
      }
      content="Edit"
    />
  );
}

/**
 * A catalogue form in a dialog (the warband pages' Add item, New skill, ...): closing it with
 * changes unsaved (Cancel, Escape, a click outside) asks "Discard changes?" first.
 */
export function CatalogueFormDialog({
  form,
  dialog,
  editing,
  title,
  headerAside,
  noun = "entry",
  trigger,
  defaultTrigger,
  submitLabel,
  canDelete = false,
  onReset,
  children,
}: CatalogueFormDialogProps) {
  const discard = useDiscardChanges({
    dirty: Boolean(form.dirty),
    onClose: () => {
      dialog.setOpen(false);
      onReset();
      form.deleteConfirm?.close();
    },
  });
  const handleOpenChange = (next: boolean) => (next ? dialog.setOpen(true) : discard.close());
  const { deleteConfirm, remove, revert } = form;
  const triggerNode = trigger === undefined ? defaultTrigger : trigger;
  const offersDelete = Boolean(
    editing && canDelete && deleteConfirm && remove && entrySource(editing) !== "version"
  );
  const offersRevert = Boolean(editing && revert && canRevert(editing));
  const closeAfter = () => {
    dialog.setOpen(false);
    onReset();
  };

  return (
    <Dialog open={dialog.open} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-[750px]">
        <DialogHeader
          className={
            headerAside ? "flex-row flex-wrap items-center justify-between gap-3" : undefined
          }
        >
          <DialogTitle>{title}</DialogTitle>
          {headerAside}
        </DialogHeader>
        <div className="space-y-4">
          {children}
          {form.formError ? <p className="text-sm text-danger">{form.formError}</p> : null}
          {editing?.generated_effect_key && revert ? (
            <RuleVersionNote
              effectKey={editing.generated_effect_key}
              campaignId={revert.campaignId}
            />
          ) : null}
        </div>
        <DialogFooter
          className={editing ? "flex flex-wrap items-center justify-between gap-3" : undefined}
        >
          {offersDelete && deleteConfirm ? (
            <Button
              variant="secondary"
              type="button"
              onClick={deleteConfirm.open}
              disabled={form.isSaving}
              className="mr-auto"
            >
              {editing?.campaign_id == null ? "Remove" : "Delete"}
            </Button>
          ) : null}
          {offersRevert && revert ? (
            <RevertButton revert={revert} disabled={form.isSaving} />
          ) : null}
          <Button
            variant="secondary"
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={form.isSaving}
          >
            Cancel
          </Button>
          <Button onClick={() => void form.save(closeAfter)} disabled={form.isSaving}>
            {form.isSaving ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
      {discard.confirm}
      {editing && offersRevert && revert ? (
        <RevertConfirm revert={revert} entry={editing} onReverted={closeAfter} />
      ) : null}
      {editing && offersDelete && deleteConfirm && remove ? (
        <CatalogueDeleteConfirm
          confirm={deleteConfirm}
          entry={editing}
          noun={noun}
          isDeleting={form.isSaving}
          onConfirm={() =>
            void remove(() => {
              dialog.setOpen(false);
              deleteConfirm.close();
            })
          }
        />
      ) : null}
    </Dialog>
  );
}
