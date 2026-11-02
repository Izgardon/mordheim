import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { warbandTreasuryQuery } from "../../api/economy-queries";
import { useLedgerRowEdit } from "../../api/ledger-queries";
import { getErrorMessage } from "@/lib/get-error-message";
import { ADJUSTMENT, useTreasuryEntryForm } from "../../hooks/warband/useTreasuryEntryForm";
import { formatTradeDate } from "../../utils/warband-utils";

type TreasuryTabProps = { campaignId: number; warbandId: number; canEdit: boolean };

/** The ledger (design E, kept simple): its rows, Add trade entry, Correct, and Edit on a row entered by hand. */
export default function TreasuryTab({ campaignId, warbandId, canEdit }: TreasuryTabProps) {
  const ledger = useInfiniteQuery(warbandTreasuryQuery(campaignId, warbandId));
  const form = useTreasuryEntryForm(warbandId);
  const rows = ledger.data?.pages.flatMap((page) => page.results) ?? [];
  const rowEdit = useLedgerRowEdit(warbandId);
  const [editing, setEditing] = useState<{ id: number; description: string; notes: string } | null>(
    null
  );
  const saveEdit = () => {
    if (!editing) return;
    const { id, description, notes } = editing;
    rowEdit.mutate(
      { tradeId: id, description: description.trim(), notes: notes.trim() },
      {
        onSuccess: () => setEditing(null),
        onError: (error) =>
          toast.error("The entry didn't save.", { description: getErrorMessage(error) }),
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {canEdit && !form.isFormOpen ? (
        <Button variant="secondary" className="self-start" onClick={form.handleOpenForm}>
          Add trade entry
        </Button>
      ) : null}
      {form.isFormOpen ? (
        <form
          className="grid gap-2 border border-border bg-surface p-3 min-[720px]:grid-cols-[140px_minmax(0,1fr)_100px]"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Input
            aria-label="Action"
            placeholder="Action"
            value={form.formAction}
            onChange={(event) => form.setFormAction(event.target.value)}
          />
          <Input
            aria-label="Description"
            placeholder={form.isAdjustment ? "Reason" : "What"}
            value={form.formDescription}
            onChange={(event) => form.setFormDescription(event.target.value)}
          />
          <NumberInput
            aria-label="Gold"
            placeholder="gc"
            value={form.formPrice}
            onChange={(event) => form.setFormPrice(event.target.value)}
          />
          {form.submitError ? (
            <p className="text-sm text-danger min-[720px]:col-span-3">{form.submitError}</p>
          ) : null}
          <div className="flex gap-2 min-[720px]:col-span-3">
            <Button size="sm" type="submit" disabled={form.isSubmitting}>
              Save entry
            </Button>
            <Button size="sm" variant="ghost" onClick={form.handleCloseForm}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {ledger.isPending ? (
        <p className="text-sm text-muted-foreground">Reading the ledger…</p>
      ) : null}
      <ul className="m-0 flex list-none flex-col border-t border-line p-0">
        {rows.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[90px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-2.5"
          >
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-faint">
              {row.action}
            </span>
            {editing?.id === row.id ? (
              <span className="flex min-w-0 flex-col gap-1.5">
                <Input
                  inputSize="sm"
                  aria-label="Description"
                  value={editing.description}
                  onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                />
                <Input
                  inputSize="sm"
                  aria-label="Notes"
                  placeholder="Notes"
                  value={editing.notes}
                  onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                />
                <span className="flex gap-2">
                  <Button size="sm" disabled={rowEdit.isPending} onClick={saveEdit}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </span>
              </span>
            ) : (
              <span className="flex min-w-0 flex-col">
                <span className="text-sm text-ink">{row.description}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTradeDate(row.created_at)}
                  {row.created_by ? ` · ${row.created_by.name}` : ""}
                  {row.notes ? ` · ${row.notes}` : ""}
                </span>
              </span>
            )}
            <span className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-head">{row.price} gc</span>
              {canEdit && row.created_by && editing?.id !== row.id ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setEditing({ id: row.id, description: row.description, notes: row.notes ?? "" })
                  }
                >
                  Edit
                </Button>
              ) : null}
              {canEdit && row.action !== ADJUSTMENT ? (
                <Button size="sm" variant="ghost" onClick={() => form.startCorrection(row)}>
                  Correct
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {ledger.hasNextPage ? (
        <Button
          variant="secondary"
          className="self-center"
          disabled={ledger.isFetchingNextPage}
          onClick={() => void ledger.fetchNextPage()}
        >
          Older entries
        </Button>
      ) : null}
    </div>
  );
}
