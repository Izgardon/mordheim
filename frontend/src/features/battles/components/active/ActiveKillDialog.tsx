import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import SearchableDropdown from "@/features/warbands/components/shared/forms/SearchableDropdown";

import type { ActiveBattleUnitOption } from "./active-utils";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [selectedVictimUnitKey, setSelectedVictimUnitKey] = useState("");
  const [customVictimName, setCustomVictimName] = useState("");
  const [notes, setNotes] = useState("");
  const [earnedXp, setEarnedXp] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const filteredOptions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return options.filter((option) => {
      if (option.unitKey === killerUnitKey) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return option.label.toLowerCase().includes(normalizedSearch);
    });
  }, [killerUnitKey, options, searchTerm]);

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
      setIsTargetDropdownOpen(false);
      return;
    }
    setSearchTerm("");
    setIsTargetDropdownOpen(false);
    setCustomVictimName("");
    setNotes("");
    setEarnedXp(showEarnedXpOption ? defaultEarnedXp : false);
    setError("");
    setSelectedVictimUnitKey("");
  }, [defaultEarnedXp, open, showEarnedXpOption]);

  useEffect(() => {
    if (!selectedVictimUnitKey || filteredOptions.some((option) => option.unitKey === selectedVictimUnitKey)) {
      return;
    }
    setSelectedVictimUnitKey("");
  }, [filteredOptions, selectedVictimUnitKey]);

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
          <SearchableDropdown
            query={searchTerm}
            onQueryChange={setSearchTerm}
            placeholder="Search unit name"
            inputClassName="h-9"
            items={filteredOptions}
            isOpen={isTargetDropdownOpen}
            onFocus={() => setIsTargetDropdownOpen(true)}
            onBlur={() => setIsTargetDropdownOpen(false)}
            onSelectItem={(option) => {
              setSelectedVictimUnitKey(option.unitKey);
              setSearchTerm(option.label);
              setCustomVictimName("");
              setIsTargetDropdownOpen(false);
            }}
            renderItem={(option) => (
              <span className="text-sm text-foreground">{option.label}</span>
            )}
            getItemKey={(option) => `${option.unitKey}-${option.participantUserId}`}
            emptyMessage="No matching units"
          />

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

          <div className="rounded-md border border-border/40 bg-black/30 px-3 py-2 text-sm">
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
              className="w-full rounded-md border border-border/40 bg-black/30 px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#6f5a43]"
            />
          </div>

          {showEarnedXpOption ? (
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={earnedXp}
                onChange={(event) => setEarnedXp(event.currentTarget.checked)}
              />
              <span className="text-sm text-foreground">Earned XP</span>
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
