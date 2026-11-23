import { useState } from "react";

import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogKicker,
  DialogTitle,
} from "@components/dialog";
import { useDirtySince, useDiscardChanges } from "@/components/ui/discard-changes";
import { useCampaignCharts } from "@/features/rules/api/rule-queries";
import { getErrorMessage } from "@/lib/get-error-message";

import type { useLocationWrites } from "../api/location-queries";
import type { CampaignLocation, LocationGroup, LocationPayload } from "../types";
import LocationFields from "./LocationFields";
import LocationTablesField from "./LocationTablesField";

/** What the dialog edits: a location, or a new one in a group; undefined while closed. */
export type LocationEditing = { location: CampaignLocation } | { groupId: number } | undefined;

function formOf(editing: LocationEditing): LocationPayload {
  const location = editing && "location" in editing ? editing.location : null;
  return {
    group_id: location?.group_id ?? (editing && "groupId" in editing ? editing.groupId : 0),
    name: location?.name ?? "",
    rules: location?.rules ?? "",
    min_heroes: location?.min_heroes ?? 1,
    max_heroes: location?.max_heroes ?? 1,
    takes_trading_action: location?.takes_trading_action ?? false,
    tables: (location?.tables ?? []).map(({ title, description, dice, note, rows }) => ({
      title,
      description,
      dice,
      note,
      rows: rows.map(({ result, name, text, chart }) => ({
        result,
        name,
        text,
        chart: chart ?? null,
      })),
    })),
    chart_ids: (location?.charts ?? []).map((link) => link.id),
  };
}

/** A blank result is dropped, and a table left with none or no title. */
function cleaned(form: LocationPayload): LocationPayload {
  const tables = form.tables
    .map((table) => ({
      ...table,
      title: table.title.trim(),
      rows: table.rows
        .map((row) => ({ ...row, result: row.result.trim() }))
        .filter((row) => row.result || row.name.trim() || row.text.trim()),
    }))
    .filter((table) => table.title && table.rows.length);
  return { ...form, name: form.name.trim(), rules: form.rules.trim(), tables };
}

/**
 * Add a location or edit one, with its own tables. The form runs well past eight inputs, so
 * closing it with changes unsaved asks "Discard changes?" first (William, 5 Nov 2026).
 */
export default function LocationDialog({
  campaignId,
  editing,
  groups,
  writes,
  onClose,
}: {
  campaignId: number;
  editing: LocationEditing;
  groups: LocationGroup[];
  writes: ReturnType<typeof useLocationWrites>;
  onClose: () => void;
}) {
  const charts = useCampaignCharts(campaignId).data ?? [];
  const [form, setForm] = useState(() => formOf(editing));
  const [error, setError] = useState("");
  const [shown, setShown] = useState(editing);
  const { dirty, markClean } = useDirtySince(form);
  if (shown !== editing) {
    setShown(editing);
    setForm(formOf(editing));
    setError("");
    markClean();
  }
  const discard = useDiscardChanges({ dirty, onClose });
  const location = editing && "location" in editing ? editing.location : null;
  const save = () =>
    writes.saveLocation.mutate(
      { ...cleaned(form), id: location?.id },
      {
        onSuccess: () => {
          markClean();
          onClose();
        },
        onError: (failure) => setError(getErrorMessage(failure, "Couldn't save the location.")),
      }
    );

  return (
    <Dialog open={editing !== undefined} onOpenChange={(next) => !next && discard.close()}>
      <DialogContent className="max-w-[860px]">
        <DialogHeader>
          <DialogKicker>Trade locations</DialogKicker>
          <DialogTitle>{location ? "Edit the location" : "Add a location"}</DialogTitle>
        </DialogHeader>
        <LocationFields value={form} onChange={setForm} groups={groups} charts={charts} />
        <LocationTablesField
          tables={form.tables}
          onChange={(tables) => setForm({ ...form, tables })}
        />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button onClick={save} disabled={writes.saveLocation.isPending || !form.name.trim()}>
            {writes.saveLocation.isPending ? "Saving…" : location ? "Save changes" : "Add location"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {discard.confirm}
    </Dialog>
  );
}
