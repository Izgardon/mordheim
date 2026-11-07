import { useState } from "react";

import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogKicker,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
import { getErrorMessage } from "@/lib/get-error-message";

import type { useCampaignRuleWrites } from "../hooks/useCampaignRuleWrites";
import type { CampaignRule, CampaignRulePayload } from "../types/rule-types";
import CampaignRuleFields from "./CampaignRuleFields";

/** Edit a campaign rule's title and body, or delete it (after a confirm). */
export default function EditCampaignRuleDialog({
  rule,
  writes,
  onDeleted,
}: {
  rule: CampaignRule;
  writes: ReturnType<typeof useCampaignRuleWrites>;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<CampaignRulePayload>({ title: rule.title, body: rule.body });
  const [error, setError] = useState("");
  const busy = writes.update.isPending || writes.remove.isPending;

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) setForm({ title: rule.title, body: rule.body });
    setError("");
  };
  const save = () =>
    writes.update.mutate(
      { id: rule.id, title: form.title.trim(), body: form.body.trim() },
      {
        onSuccess: () => setOpen(false),
        onError: (failure) => setError(getErrorMessage(failure, "Couldn't save the rule.")),
      }
    );
  const remove = () =>
    writes.remove.mutate(rule.id, {
      onSuccess: () => {
        setDeleting(false);
        setOpen(false);
        onDeleted();
      },
      onError: (failure) => setError(getErrorMessage(failure, "Couldn't delete the rule.")),
    });

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="min-h-10 self-start">
          Edit campaign rule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogKicker>Campaign rules</DialogKicker>
          <DialogTitle>Edit the campaign rule</DialogTitle>
        </DialogHeader>
        <CampaignRuleFields value={form} onChange={setForm} />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="danger" onClick={() => setDeleting(true)} disabled={busy}>
            Delete
          </Button>
          <Button onClick={save} disabled={busy || !form.title.trim()}>
            {writes.update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        description={
          <span>
            Delete <span className="font-semibold text-ink">{rule.title}</span>? This can&apos;t be
            undone.
          </span>
        }
        confirmText={writes.remove.isPending ? "Deleting…" : "Delete rule"}
        confirmDisabled={busy}
        isConfirming={writes.remove.isPending}
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </Dialog>
  );
}
