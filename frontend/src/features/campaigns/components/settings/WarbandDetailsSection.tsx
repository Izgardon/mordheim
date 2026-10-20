import { useEffect, useState } from "react";

import { Button } from "@components/button";
import { Input } from "@components/input";
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";
import { getErrorMessage } from "@/lib/get-error-message";

import { updateWarband } from "@/features/warbands/api/warbands-api";

import type { Warband } from "@/features/warbands/types/warband-types";

type WarbandDetailsSectionProps = {
  warband: Warband;
  canEdit: boolean;
  onWarbandUpdated: (warband: Warband) => void;
};

function ReadOnlyValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

/** Your warband's name and maximum unit limit, edited together. */
export default function WarbandDetailsSection({
  warband,
  canEdit,
  onWarbandUpdated,
}: WarbandDetailsSectionProps) {
  const currentMaxUnits = warband.max_units ?? 15;
  const [warbandName, setWarbandName] = useState(warband.name);
  const [maxUnits, setMaxUnits] = useState(String(currentMaxUnits));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setWarbandName(warband.name);
  }, [warband.name]);

  useEffect(() => {
    setMaxUnits(String(currentMaxUnits));
  }, [currentMaxUnits]);

  const parsedMaxUnits = Number(maxUnits);
  const hasChanged = warbandName.trim() !== warband.name || parsedMaxUnits !== currentMaxUnits;

  const cancel = () => {
    setIsEditing(false);
    setWarbandName(warband.name);
    setMaxUnits(String(currentMaxUnits));
    setError("");
  };

  const save = async () => {
    const trimmedName = warbandName.trim();
    if (!trimmedName) {
      setError("Warband name is required.");
      return;
    }
    if (!Number.isInteger(parsedMaxUnits) || parsedMaxUnits < 1) {
      setError("Max limit must be a whole number of at least 1.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateWarband(warband.id, {
        name: trimmedName,
        max_units: parsedMaxUnits,
      });
      onWarbandUpdated({ ...warband, name: updated.name, max_units: updated.max_units });
      setIsEditing(false);
      setMessage("Warband details updated.");
      setTimeout(() => setMessage(""), 3000);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save warband details."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-label="Warband details" className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Warband</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Update your warband name and maximum unit limit.
          </p>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="secondary" size="sm" onClick={cancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="min-w-[4.5rem]"
                  onClick={save}
                  disabled={isSaving || !hasChanged}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label
              htmlFor="warband-settings-name"
              className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
            >
              Warband Name
            </Label>
            <Input
              id="warband-settings-name"
              value={warbandName}
              onChange={(event) => setWarbandName(event.target.value)}
              placeholder="Ashen Crows"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="warband-settings-max-units"
              className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
            >
              Max Limit
            </Label>
            <NumberInput
              id="warband-settings-max-units"
              min={1}
              value={maxUnits}
              onChange={(event) => setMaxUnits(event.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyValue label="Warband Name" value={warband.name} />
          <ReadOnlyValue label="Max Limit" value={currentMaxUnits} />
        </div>
      )}

      {message && <p className="min-h-[1.25rem] text-sm text-emerald-400">{message}</p>}
      {error && <p className="min-h-[1.25rem] text-sm text-red-600">{error}</p>}
    </section>
  );
}
