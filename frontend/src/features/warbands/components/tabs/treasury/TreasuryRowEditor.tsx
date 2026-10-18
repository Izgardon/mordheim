import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@components/input";
import { getErrorMessage } from "@/lib/get-error-message";
import { useLedgerRowEdit } from "../../../api/economy-queries";

import type { WarbandTrade } from "../../../types/warband-types";

type TreasuryRowEditorProps = {
  row: WarbandTrade;
  warbandId: number;
  onDone: () => void;
};

/**
 * A hand-entered row's description and notes, edited in place (decision 6). Its gold never
 * changes here: an Adjustment corrects it.
 */
export default function TreasuryRowEditor({ row, warbandId, onDone }: TreasuryRowEditorProps) {
  const { mutateAsync: saveRow, isPending } = useLedgerRowEdit(warbandId);
  const [description, setDescription] = useState(row.description);
  const [notes, setNotes] = useState(row.notes);
  const [error, setError] = useState("");
  const ids = { description: useId(), notes: useId() };

  const handleSave = async () => {
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    setError("");
    try {
      await saveRow({ tradeId: row.id, description: description.trim(), notes: notes.trim() });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="mt-2 space-y-2 pl-[3.75rem]">
      <div>
        <label htmlFor={ids.description} className="mb-1 block text-xs text-muted-foreground">
          Description
        </label>
        <Input
          id={ids.description}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={ids.notes} className="mb-1 block text-xs text-muted-foreground">
          Notes
        </label>
        <textarea
          id={ids.notes}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
