import { useMemo, useState, type ComponentProps } from "react";

import { Button } from "@components/button";
import EditBattleRecordDialog from "@/features/battles/components/record/EditBattleRecordDialog";

import BattleHistoryTable from "./BattleHistoryTable";

/**
 * Battle History with Edit for battle managers (BATL-NEW-04): each battle's details offer "Edit
 * record", which changes that record only; the list is read again after a save.
 */
export default function BattleHistorySection({
  campaignId,
  canEditRecords,
  onRecordSaved,
  ...table
}: ComponentProps<typeof BattleHistoryTable> & {
  campaignId: number;
  canEditRecords: boolean;
  onRecordSaved: () => void;
}) {
  const [editingBattleId, setEditingBattleId] = useState<number | null>(null);
  const warbands = useMemo(
    () =>
      table.players.flatMap((player) =>
        player.warband
          ? [
              {
                warbandId: player.warband.id,
                warbandName: player.warband.name,
                playerLabel: player.name,
              },
            ]
          : []
      ),
    [table.players]
  );
  return (
    <>
      <BattleHistoryTable
        {...table}
        renderBattleActions={
          canEditRecords
            ? (battle) => (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-11"
                  onClick={() => setEditingBattleId(battle.id)}
                  aria-label={`Edit the record of ${battle.scenario || `battle #${battle.id}`}`}
                >
                  Edit record
                </Button>
              )
            : undefined
        }
      />
      <EditBattleRecordDialog
        campaignId={campaignId}
        battleId={editingBattleId}
        warbands={warbands}
        onOpenChange={(open) => !open && setEditingBattleId(null)}
        onSaved={onRecordSaved}
      />
    </>
  );
}
