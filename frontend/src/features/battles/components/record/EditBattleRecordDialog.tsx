import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getBattleRecord, updateBattleRecord } from "@/features/battles/api/battles-api";
import { HELPER_DIALOG_CONTENT_CLASS } from "@/features/battles/components/shared/battle-dialog-styles";
import type { BattleRecord } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

/** A campaign warband that can take part in the record. */
export type RecordWarband = { warbandId: number; warbandName: string; playerLabel: string };

const LABEL = "text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground";
const today = () => new Date().toISOString().slice(0, 10);

type Form = {
  scenario: string;
  link: string;
  date: string;
  players: number[];
  winners: number[];
};

const formOf = (record: BattleRecord): Form => ({
  scenario: record.scenario,
  link: record.scenario_link ?? "",
  date: record.date,
  players: record.participants.filter((entry) => !entry.removed).map((entry) => entry.warband_id),
  winners: record.winner_warband_ids,
});

/**
 * Edit a past battle's record (BATL-NEW-04, decision 3): scenario name and link, date, who took
 * part, and who won. Only this battle's record changes; nothing else is recalculated.
 */
export default function EditBattleRecordDialog({
  campaignId,
  battleId,
  warbands,
  onOpenChange,
  onSaved,
}: {
  campaignId: number;
  /** The battle being edited; null when closed. */
  battleId: number | null;
  warbands: RecordWarband[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const recordQuery = useQuery({
    queryKey: queryKeys.campaign.battleRecord(campaignId, battleId ?? 0),
    queryFn: () => getBattleRecord(campaignId, battleId ?? 0),
    enabled: battleId !== null,
    gcTime: 0,
    staleTime: 0,
  });
  const record = recordQuery.data;
  const [form, setForm] = useState<Form | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setForm(record ? formOf(record) : null);
    setError("");
  }, [record]);

  // Every campaign warband, plus anyone on the record who has since left the campaign.
  const options = useMemo(() => {
    const byId = new Map(warbands.map((warband) => [warband.warbandId, warband]));
    for (const entry of record?.participants ?? []) {
      if (!byId.has(entry.warband_id)) {
        byId.set(entry.warband_id, {
          warbandId: entry.warband_id,
          warbandName: entry.warband_name,
          playerLabel: entry.user_label,
        });
      }
    }
    return [...byId.values()];
  }, [record?.participants, warbands]);

  const toggle = (key: "players" | "winners", warbandId: number, on: boolean) =>
    setForm((current) => {
      if (!current) return current;
      const list = on
        ? [...current[key], warbandId]
        : current[key].filter((entry) => entry !== warbandId);
      // Off the record means off the winners too.
      const winners =
        key === "players" && !on
          ? current.winners.filter((id) => id !== warbandId)
          : current.winners;
      return { ...current, winners, [key]: list };
    });

  const save = async () => {
    if (!form || battleId === null) return;
    if (form.players.length < 2) {
      setError("A battle needs at least two warbands.");
      return;
    }
    const winners = form.winners.filter((id) => form.players.includes(id));
    setIsSaving(true);
    setError("");
    try {
      await updateBattleRecord(campaignId, battleId, {
        scenario: form.scenario.trim(),
        scenario_link: form.link.trim() || null,
        date: form.date,
        participants: form.players.map((warbandId) => ({ warband_id: warbandId })),
        winners,
        // "No winner": nobody lost either.
        losers: winners.length > 0 ? form.players.filter((id) => !winners.includes(id)) : [],
      });
      onSaved();
      onOpenChange(false);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to save the record"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={battleId !== null} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-xl ${HELPER_DIALOG_CONTENT_CLASS}`}>
        <DialogHeader>
          <DialogTitle>Edit battle record</DialogTitle>
          <DialogDescription className="block text-sm text-muted-foreground">
            Only this battle's record changes. No wins, losses, XP, gold or kills are recalculated,
            and nothing on the warbands changes.
          </DialogDescription>
        </DialogHeader>
        {recordQuery.isPending && battleId !== null ? (
          <p className="text-sm text-muted-foreground">Loading the record...</p>
        ) : recordQuery.error ? (
          <p className="text-sm text-red-600">
            {getErrorMessage(recordQuery.error, "Unable to load the record")}
          </p>
        ) : form ? (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className={LABEL}>Scenario</span>
              <Input
                value={form.scenario}
                onChange={(event) => setForm({ ...form, scenario: event.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className={LABEL}>Scenario link</span>
              <Input
                value={form.link}
                placeholder="https://..."
                onChange={(event) => setForm({ ...form, link: event.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className={LABEL}>Date</span>
              <Input
                type="date"
                value={form.date}
                max={today()}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
            <fieldset className="space-y-2">
              <legend className={LABEL}>Warbands and winners</legend>
              {options.map((option) => {
                const playing = form.players.includes(option.warbandId);
                return (
                  <div
                    key={option.warbandId}
                    className="battle-inline-panel flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-1"
                  >
                    <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={playing}
                        aria-label={`${option.warbandName} took part`}
                        onChange={(event) =>
                          toggle("players", option.warbandId, event.target.checked)
                        }
                      />
                      <span>
                        {option.warbandName}
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {option.playerLabel}
                        </span>
                      </span>
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={form.winners.includes(option.warbandId)}
                        disabled={!playing}
                        aria-label={`${option.warbandName} won`}
                        onChange={(event) =>
                          toggle("winners", option.warbandId, event.target.checked)
                        }
                      />
                      Won
                    </label>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                No winner ticked: the record says no winner, and nobody lost.
              </p>
            </fieldset>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!form || isSaving} onClick={() => void save()}>
            {isSaving ? "Saving..." : "Save record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
