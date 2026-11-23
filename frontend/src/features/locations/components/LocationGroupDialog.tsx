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
import { getErrorMessage } from "@/lib/get-error-message";

import type { useLocationWrites } from "../api/location-queries";
import type { LocationGroup, LocationGroupPayload } from "../types";
import { AREA, LABEL } from "./form-styles";

const formOf = (group: LocationGroup | null): LocationGroupPayload => ({
  name: group?.name ?? "",
  description: group?.description ?? "",
  restrictions: group?.restrictions ?? "",
});

/** Add a location group or edit one: its name, what it is, and who may go (text the player reads). */
export default function LocationGroupDialog({
  group,
  onClose,
  writes,
}: {
  /** The group being edited, null to add one; undefined while closed. */
  group: LocationGroup | null | undefined;
  onClose: () => void;
  writes: ReturnType<typeof useLocationWrites>;
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
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      restrictions: form.restrictions.trim(),
    };
    const done = {
      onSuccess: onClose,
      onError: (failure: unknown) => setError(getErrorMessage(failure, "Couldn't save the group.")),
    };
    if (group) writes.updateGroup.mutate({ id: group.id, ...payload }, done);
    else writes.createGroup.mutate(payload, done);
  };
  const field = (key: "description" | "restrictions", label: string) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-${key}`} className={LABEL}>
        {label}
      </label>
      <textarea
        id={`${id}-${key}`}
        className={`${AREA} min-h-[72px]`}
        maxLength={4000}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
    </div>
  );

  return (
    <Dialog open={group !== undefined} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogKicker>Locations</DialogKicker>
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
          {field("description", "Description")}
          {field("restrictions", "Restrictions")}
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
