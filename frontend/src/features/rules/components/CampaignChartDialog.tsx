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
import { useDirtySince, useDiscardChanges } from "@/components/ui/discard-changes";
import { getErrorMessage } from "@/lib/get-error-message";

import type { useCampaignChartWrites } from "../hooks/useCampaignChartWrites";
import type { CampaignChart, CampaignChartPayload } from "../types/rule-types";
import CampaignChartFields from "./CampaignChartFields";

const BLANK: CampaignChartPayload = {
  title: "",
  description: "",
  dice: "D6",
  note: "",
  umbrella: "",
  rows: [{ result: "", name: "", text: "" }],
};

const formOf = (chart: CampaignChart | null): CampaignChartPayload =>
  chart
    ? {
        title: chart.title,
        description: chart.description,
        dice: chart.dice,
        note: chart.note,
        umbrella: chart.umbrella,
        rows: chart.rows.map((row) => ({ result: row.result, name: row.name, text: row.text })),
      }
    : { ...BLANK, rows: [{ result: "", name: "", text: "" }] };

/**
 * Add a chart or edit one, with its results. The form has far more than eight inputs, so closing
 * it with changes unsaved asks "Discard changes?" first (William, 5 Nov 2026). A blank result is
 * dropped on save, so a row left empty costs nothing.
 */
export default function CampaignChartDialog({
  chart = null,
  writes,
  trigger,
  onSaved,
  onDeleted,
}: {
  /** The chart being edited; none to add one. */
  chart?: CampaignChart | null;
  writes: ReturnType<typeof useCampaignChartWrites>;
  trigger: React.ReactNode;
  onSaved?: (chart: CampaignChart) => void;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<CampaignChartPayload>(() => formOf(chart));
  const [error, setError] = useState("");
  const { dirty, markClean } = useDirtySince(form);
  const busy = writes.create.isPending || writes.update.isPending || writes.remove.isPending;
  const discard = useDiscardChanges({ dirty, onClose: () => setOpen(false) });

  const openChange = (next: boolean) => {
    if (!next) return discard.close();
    setForm(formOf(chart));
    markClean();
    setError("");
    setOpen(true);
  };
  const save = () => {
    const payload = {
      ...form,
      title: form.title.trim(),
      umbrella: (form.umbrella ?? "").trim(),
      rows: form.rows
        .map((row) => ({ ...row, result: row.result.trim() }))
        .filter((row) => row.result || row.name.trim() || row.text.trim()),
    };
    const done = {
      onSuccess: (saved: CampaignChart) => {
        markClean();
        setOpen(false);
        onSaved?.(saved);
      },
      onError: (failure: unknown) => setError(getErrorMessage(failure, "Couldn't save the table.")),
    };
    if (chart) writes.update.mutate({ id: chart.id, ...payload }, done);
    else writes.create.mutate(payload, done);
  };
  const remove = () =>
    chart &&
    writes.remove.mutate(chart.id, {
      onSuccess: () => {
        setDeleting(false);
        setOpen(false);
        onDeleted?.();
      },
      onError: (failure) => setError(getErrorMessage(failure, "Couldn't delete the table.")),
    });

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-[820px]">
        <DialogHeader>
          <DialogKicker>Tables</DialogKicker>
          <DialogTitle>{chart ? "Edit the table" : "Add a table"}</DialogTitle>
        </DialogHeader>
        <CampaignChartFields value={form} onChange={setForm} />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
          {chart ? (
            <Button variant="danger" onClick={() => setDeleting(true)} disabled={busy}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={busy || !form.title.trim()}>
            {busy ? "Saving…" : chart ? "Save changes" : "Add table"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {discard.confirm}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        description={
          <span>
            Delete <span className="font-semibold text-ink">{chart?.title}</span> and its results?
            This can&apos;t be undone.
          </span>
        }
        confirmText={writes.remove.isPending ? "Deleting…" : "Delete table"}
        confirmDisabled={busy}
        isConfirming={writes.remove.isPending}
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </Dialog>
  );
}
