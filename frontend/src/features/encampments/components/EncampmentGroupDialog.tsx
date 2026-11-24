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
import { AREA, LABEL } from "@/features/locations/components/form-styles";
import { getErrorMessage } from "@/lib/get-error-message";

import type { useEncampmentWrites } from "../api/encampment-queries";
import type { EncampmentGroup, EncampmentGroupPayload } from "../types";

const formOf = (group: EncampmentGroup | null): EncampmentGroupPayload => ({
  name: group?.name ?? "",
  description: group?.description ?? "",
});

/** Add an encampment group or edit one: its name and what it is. */
export default function EncampmentGroupDialog({
  group,
  onClose,
  writes,
}: {
  /** The group being edited, null to add one; undefined while closed. */
  group: EncampmentGroup | null | undefined;
  onClose: () => void;
  writes: ReturnType<typeof useEncampmentWrites>;
}) {
  const id = useId();
  const [form, setForm] = useState(() => formOf(group ?? null));
  const [error, setError] = useState("");
  const [shown, setShown] = useState(group);
  if (shown !== group) {
    setShown(group);
    setForm(formOf(group ?? null));
    setError("");
  }
  const busy = writes.createGroup.isPending || writes.updateGroup.isPending;
  const save = () => {
    const payload = { name: form.name.trim(), description: form.description.trim() };
    const done = {
      onSuccess: onClose,
      onError: (failure: unknown) => setError(getErrorMessage(failure, "Couldn't save the group.")),
    };
    if (group) writes.updateGroup.mutate({ id: group.id, ...payload }, done);
    else writes.createGroup.mutate(payload, done);
  };

  return (
    <Dialog open={group !== undefined} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogKicker>Encampments</DialogKicker>
          <DialogTitle>{group ? "Edit the group" : "Add a group"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-name`} className={LABEL}>
              Name
            </label>
            <Input
              id={`${id}-name`}
              maxLength={160}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-description`} className={LABEL}>
              Description
            </label>
            <textarea
              id={`${id}-description`}
              className={`${AREA} min-h-[72px]`}
              maxLength={4000}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button onClick={save} disabled={busy || !form.name.trim()}>
            {busy ? "Saving…" : group ? "Save changes" : "Add group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
