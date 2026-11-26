import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * Add a creature group (William, 25 Nov 2026: "just a named group where I can add whatever unit to
 * it in whatever amounts"): its name alone. It starts empty; Add a unit fills it.
 */
export default function AddNeutralGroupSheet({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setName("");
      setError("");
    }
  }, [open]);

  const add = async () => {
    const typed = name.trim();
    if (!typed) {
      setError("Give the group a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onAdd(typed);
      onOpenChange(false);
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't add the group."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Monsters or bystanders"
      title="Add a creature group"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="min-h-12 text-[15px]" disabled={saving} onClick={() => void add()}>
            {saving ? "Adding…" : "Add the group"}
          </Button>
        </div>
      }
    >
      <label className="flex flex-col gap-1 text-xs font-bold text-text2">
        Group name
        <Input
          value={name}
          placeholder="The Restless Dead"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void add();
          }}
        />
      </label>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </ModalSheet>
  );
}
