import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import TreasuryEntryForm from "./treasury/TreasuryEntryForm";
import TreasuryRow from "./treasury/TreasuryRow";

import { warbandTreasuryQuery } from "../../api/economy-queries";
import { useTreasuryEntryForm } from "../../hooks/warband/useTreasuryEntryForm";

import type { Warband } from "../../types/warband-types";

type TreasuryTabProps = {
  warband: Warband;
  canEdit?: boolean;
  isMobile?: boolean;
};

const loadErrorOf = (error: unknown) =>
  error instanceof Error ? error.message || "Unable to load trades" : "Unable to load trades";

/** The Treasury tab: the warband's ledger, newest first, and a manual entry form for editors. */
export default function TreasuryTab({
  warband,
  canEdit = false,
  isMobile = false,
}: TreasuryTabProps) {
  const treasury = useQuery(warbandTreasuryQuery(warband.campaign_id, warband.id));
  const form = useTreasuryEntryForm(warband.id);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const toggleGroup = useCallback((id: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rows = treasury.data ?? [];

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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
