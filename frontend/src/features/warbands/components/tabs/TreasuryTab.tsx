import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import TreasuryEntryForm from "./treasury/TreasuryEntryForm";
import TreasuryRow from "./treasury/TreasuryRow";
import TreasuryRowEditor from "./treasury/TreasuryRowEditor";

import { warbandTreasuryQuery } from "../../api/economy-queries";
import { useTreasuryEntryForm } from "../../hooks/warband/useTreasuryEntryForm";

import type { Warband, WarbandTrade } from "../../types/warband-types";

type TreasuryTabProps = {
  warband: Warband;
  canEdit?: boolean;
  isMobile?: boolean;
};

const loadErrorOf = (error: unknown) =>
  error instanceof Error ? error.message || "Unable to load trades" : "Unable to load trades";

/** Correct (an Adjustment linked to the row) and, for a row entered by hand, Edit. */
function RowActions({
  row,
  onCorrect,
  onEdit,
}: {
  row: WarbandTrade;
  onCorrect: (row: WarbandTrade) => void;
  onEdit: (id: number) => void;
}) {
  const linkClass = "shrink-0 text-xs text-muted-foreground underline hover:text-foreground";
  return (
    <>
      <button
        type="button"
        className={linkClass}
        aria-label={`Correct ${row.description}`}
        onClick={() => onCorrect(row)}
      >
        Correct
      </button>
      {row.created_by ? (
        <button
          type="button"
          className={linkClass}
          aria-label={`Edit ${row.description}`}
          onClick={() => onEdit(row.id)}
        >
          Edit
        </button>
      ) : null}
    </>
  );
}

/**
 * The Treasury tab: the warband's ledger, newest first, signed as the server stores it. Editors
 * add entries and Adjustments (a row's gold is corrected, never changed or deleted: decision 5)
 * and edit the description and notes of rows entered by hand (decision 6).
 */
export default function TreasuryTab({
  warband,
  canEdit = false,
  isMobile = false,
}: TreasuryTabProps) {
  const treasury = useInfiniteQuery(warbandTreasuryQuery(warband.campaign_id, warband.id));
  const form = useTreasuryEntryForm(warband.id);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);

  const toggleGroup = useCallback((id: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rows = useMemo(
    () => treasury.data?.pages.flatMap((page) => page.results) ?? [],
    [treasury.data]
  );
  // What a correction's row says about the row it corrects (when that row is loaded).
  const descriptions = useMemo(
    () => new Map(rows.flatMap((row) => [row, ...row.children]).map((r) => [r.id, r.description])),
    [rows]
  );
  const correctsOf = (row: WarbandTrade) =>
    row.corrects_id ? (descriptions.get(row.corrects_id) ?? "an earlier entry") : undefined;

  return (
    <div className="relative space-y-4">
      {canEdit && !form.isFormOpen ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={form.handleOpenForm}>
            Add Trade Entry
          </Button>
        </div>
      ) : null}

      {form.isFormOpen ? <TreasuryEntryForm form={form} isMobile={isMobile} /> : null}

      <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border/60 bg-black/20">
        {treasury.isPending ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">Loading trades...</p>
        ) : treasury.isError ? (
          <p className="px-3 py-3 text-sm text-red-600">{loadErrorOf(treasury.error)}</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">No trades recorded yet.</p>
        ) : (
          <div className="space-y-0">
            {rows.map((row, index) => (
              <TreasuryRow
                key={row.id}
                row={row}
                index={index}
                expanded={expandedGroups.has(row.id)}
                onToggle={toggleGroup}
                corrects={correctsOf(row)}
                actions={
                  canEdit ? (
                    <RowActions row={row} onCorrect={form.startCorrection} onEdit={setEditingId} />
                  ) : null
                }
                editor={
                  editingId === row.id ? (
                    <TreasuryRowEditor
                      row={row}
                      warbandId={warband.id}
                      onDone={() => setEditingId(null)}
                    />
                  ) : undefined
                }
              />
            ))}
            {treasury.hasNextPage ? (
              <div className="flex justify-center p-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void treasury.fetchNextPage()}
                  disabled={treasury.isFetchingNextPage}
                >
                  {treasury.isFetchingNextPage ? "Loading..." : "Load more"}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
