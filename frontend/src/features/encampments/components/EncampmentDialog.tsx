import { useId, useState } from "react";

import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogKicker,
  DialogTitle,
} from "@components/dialog";
import { Input } from "@components/input";
import { Switch } from "@/components/ui/switch";
import { AREA, LABEL } from "@/features/locations/components/form-styles";
import { getErrorMessage } from "@/lib/get-error-message";

import type { useEncampmentWrites } from "../api/encampment-queries";
import type { CampaignEncampment, EncampmentGroup, EncampmentPayload } from "../types";

const SELECT = "min-h-10 border border-strong bg-page px-2 text-sm text-ink";

/** What the dialog edits: an encampment, or a new one in a group; undefined while closed. */
export type EncampmentEditing =
  | { encampment: CampaignEncampment }
  | { groupId: number }
  | undefined;

function formOf(editing: EncampmentEditing): EncampmentPayload {
  const camp = editing && "encampment" in editing ? editing.encampment : null;
  return {
    group_id: camp?.group_id ?? (editing && "groupId" in editing ? editing.groupId : 0),
    name: camp?.name ?? "",
    gained_by: camp?.gained_by ?? "",
    fortified: camp?.fortified ?? false,
    text: camp?.text ?? "",
  };
}

/** Add an encampment or edit one: its name, group, how it is gained, fortified, what it gives. */
export default function EncampmentDialog({
  editing,
  groups,
  writes,
  onClose,
}: {
  editing: EncampmentEditing;
  groups: EncampmentGroup[];
  writes: ReturnType<typeof useEncampmentWrites>;
  onClose: () => void;
}) {
  const id = useId();
  const [form, setForm] = useState(() => formOf(editing));
  const [error, setError] = useState("");
  const [shown, setShown] = useState(editing);
  if (shown !== editing) {
    setShown(editing);
    setForm(formOf(editing));
    setError("");
  }
  const camp = editing && "encampment" in editing ? editing.encampment : null;
  const set = (patch: Partial<EncampmentPayload>) => setForm({ ...form, ...patch });
  const save = () =>
    writes.saveEncampment.mutate(
      {
        ...form,
        name: form.name.trim(),
        gained_by: form.gained_by.trim(),
        text: form.text.trim(),
        id: camp?.id,
      },
      {
        onSuccess: onClose,
        onError: (failure) => setError(getErrorMessage(failure, "Couldn't save the encampment.")),
      }
    );

  return (
    <Dialog open={editing !== undefined} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogKicker>Encampments</DialogKicker>
          <DialogTitle>{camp ? "Edit the encampment" : "Add an encampment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex min-w-[220px] flex-1 flex-col gap-2">
              <label htmlFor={`${id}-name`} className={LABEL}>
                Name
              </label>
              <Input
                id={`${id}-name`}
                maxLength={160}
                value={form.name}
                onChange={(event) => set({ name: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-group`} className={LABEL}>
                Group
              </label>
              <select
                id={`${id}-group`}
                className={SELECT}
                value={form.group_id}
                onChange={(event) => set({ group_id: Number(event.target.value) })}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-gained`} className={LABEL}>
              Gained by
            </label>
            <Input
              id={`${id}-gained`}
              maxLength={200}
              value={form.gained_by}
              onChange={(event) => set({ gained_by: event.target.value })}
            />
          </div>
          <Switch checked={form.fortified} onCheckedChange={(on) => set({ fortified: on })}>
            Fortified
          </Switch>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-text`} className={LABEL}>
              What holding it gives
            </label>
            <textarea
              id={`${id}-text`}
              className={`${AREA} min-h-[140px]`}
              maxLength={8000}
              value={form.text}
              onChange={(event) => set({ text: event.target.value })}
            />
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button onClick={save} disabled={writes.saveEncampment.isPending || !form.name.trim()}>
            {writes.saveEncampment.isPending ? "Saving…" : camp ? "Save changes" : "Add encampment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
