import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import type { ActiveBattleUnitOption } from "./active-utils";
import {
  HELPER_NATIVE_SELECT_CLASS,
  HELPER_NATIVE_SELECT_STYLE,
} from "./helper-dialog-styles";

const SECTION_ORDER = ["Heroes", "Henchmen", "Hired Swords", "Temporary Units"] as const;

const groupOptionsBySection = (options: ActiveBattleUnitOption[]) =>
  SECTION_ORDER.map((sectionLabel) => ({
    sectionLabel,
    options: options.filter((option) => option.sectionLabel === sectionLabel),
  })).filter((group) => group.options.length > 0);

type ActiveKillDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  killerName: string;
  killerUnitKey: string;
  showEarnedXpOption?: boolean;
  defaultEarnedXp?: boolean;
  options: ActiveBattleUnitOption[];
  onConfirm: (payload: {
    victimUnitKey?: string;
    victimName?: string;
    notes?: string;
    earnedXp: boolean;
  }) => Promise<void>;
};

export default function ActiveKillDialog({
  open,
  onOpenChange,
  killerName,
  killerUnitKey,
  showEarnedXpOption = true,
  defaultEarnedXp = true,
  options,
  onConfirm,
}: ActiveKillDialogProps) {
  const [selectedVictimUnitKey, setSelectedVictimUnitKey] = useState("");
  const [customVictimName, setCustomVictimName] = useState("");
  const [notes, setNotes] = useState("");
  const [earnedXp, setEarnedXp] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const availableOptions = useMemo(
    () => options.filter((option) => option.unitKey !== killerUnitKey),
    [killerUnitKey, options]
  );
  const groupedOptions = useMemo(() => groupOptionsBySection(availableOptions), [availableOptions]);

  const selectedVictimOption = useMemo(
    () =>
      options.find(
        (option) => option.unitKey !== killerUnitKey && option.unitKey === selectedVictimUnitKey
      ) ?? null,
    [killerUnitKey, options, selectedVictimUnitKey]
  );
  const trimmedCustomVictimName = customVictimName.trim();
  const selectedTargetName = selectedVictimOption
    ? selectedVictimOption.displayName
    : trimmedCustomVictimName
      ? `a ${trimmedCustomVictimName}`
      : "";

  useEffect(() => {
    if (!open) {
      return;
    }
    setCustomVictimName("");
    setNotes("");
    setEarnedXp(showEarnedXpOption ? defaultEarnedXp : false);
    setError("");
    setSelectedVictimUnitKey("");
  }, [defaultEarnedXp, open, showEarnedXpOption]);

  useEffect(() => {
    if (!selectedVictimUnitKey || availableOptions.some((option) => option.unitKey === selectedVictimUnitKey)) {
      return;
    }
    setSelectedVictimUnitKey("");
  }, [availableOptions, selectedVictimUnitKey]);

  const handleConfirm = async () => {
    const trimmedCustomVictimNameForSave = customVictimName.trim();
    const trimmedNotes = notes.trim();
    if (isSaving || (!selectedVictimUnitKey && !trimmedCustomVictimNameForSave)) {
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await onConfirm({
        victimUnitKey: selectedVictimUnitKey || undefined,
        victimName: trimmedCustomVictimNameForSave || undefined,
        notes: trimmedNotes || undefined,
        earnedXp: showEarnedXpOption ? earnedXp : false,
      });
      onOpenChange(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to record kill");
      } else {
        setError("Unable to record kill");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>Record Kill</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Enemy unit</span>
            <select
              value={selectedVictimUnitKey}
              onChange={(event) => {
                setSelectedVictimUnitKey(event.target.value);
                setCustomVictimName("");
              }}
              className={HELPER_NATIVE_SELECT_CLASS}
              style={HELPER_NATIVE_SELECT_STYLE}
            >
              <option value="">Select enemy unit</option>
              {groupedOptions.map((group) => (
                <optgroup key={group.sectionLabel} label={group.sectionLabel}>
                  {group.options.map((option) => (
                    <option
                      key={`${option.unitKey}-${option.participantUserId}`}
                      value={option.unitKey}
                      className="bg-[#090705] text-foreground"
                    >
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Or enter a custom target</p>
            <Input
              value={customVictimName}
              onChange={(event) => {
                setCustomVictimName(event.currentTarget.value);
                if (event.currentTarget.value.trim()) {
                  setSelectedVictimUnitKey("");
                }
              }}
              placeholder="Non-recorded unit name"
              className="h-9"
            />
          </div>

          <div className="battle-inline-panel rounded-md px-3 py-2 text-sm">
            <span className="font-semibold text-foreground">{killerName}</span>
            <span className="text-muted-foreground"> has slain </span>
            <span className="font-semibold text-foreground">{selectedTargetName || "..."}</span>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Notes (optional)</p>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              placeholder="Describe how the unit was taken out..."
              maxLength={500}
              rows={3}
              className="field-surface w-full rounded-md border-[#4b3828] bg-[#0d0907] px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#9a7a45]"
            />
          </div>

          {showEarnedXpOption ? (
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={earnedXp}
                onChange={(event) => setEarnedXp(event.currentTarget.checked)}
                className={
                  earnedXp
                    ? "[&>span]:border-[#c69b5c] [&>span]:bg-[#3a2410] [&>span]:text-[#f3d79d] [&>span]:shadow-[0_0_0_1px_rgba(198,155,92,0.38),inset_0_1px_0_rgba(255,230,180,0.12)]"
                    : "[&>span]:border-[#5a4634] [&>span]:bg-[#110c08]"
                }
              />
              <span className={`text-sm ${earnedXp ? "text-[#f3d79d]" : "text-foreground"}`}>
                Earned XP
              </span>
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={(!selectedVictimUnitKey && !customVictimName.trim()) || isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
