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
  killerLabel: string;
  killerUnitKey: string;
  options: ActiveBattleUnitOption[];
  onConfirm: (payload: {
    victimUnitKey?: string;
    victimName?: string;
    earnedXp: boolean;
  }) => Promise<void>;
};

export default function ActiveKillDialog({
  open,
  onOpenChange,
  killerLabel,
  killerUnitKey,
  options,
  onConfirm,
}: ActiveKillDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [selectedVictimUnitKey, setSelectedVictimUnitKey] = useState("");
  const [customVictimName, setCustomVictimName] = useState("");
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
  const selectedTargetLabel = (selectedVictimOption?.label ?? customVictimName.trim()) || "None";

  useEffect(() => {
    if (!open) {
      setIsTargetDropdownOpen(false);
      return;
    }
    setSearchTerm("");
    setIsTargetDropdownOpen(false);
    setCustomVictimName("");
    setEarnedXp(true);
    setError("");
    setSelectedVictimUnitKey("");
  }, [open]);

  useEffect(() => {
    if (!selectedVictimUnitKey || filteredOptions.some((option) => option.unitKey === selectedVictimUnitKey)) {
      return;
    }
    setSelectedVictimUnitKey("");
  }, [filteredOptions, selectedVictimUnitKey]);

  const handleConfirm = async () => {
    const trimmedCustomVictimName = customVictimName.trim();
    if (isSaving || (!selectedVictimUnitKey && !trimmedCustomVictimName)) {
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await onConfirm({
        victimUnitKey: selectedVictimUnitKey || undefined,
        victimName: trimmedCustomVictimName || undefined,
        earnedXp,
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
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Record Kill</DialogTitle>
          <p className="text-xs text-muted-foreground">{killerLabel}</p>
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
            <span className="text-muted-foreground">Selected target: </span>
            <span className="text-foreground">{selectedTargetLabel}</span>
          </div>

          <label className="inline-flex items-center gap-2">
            <Checkbox
              checked={earnedXp}
              onChange={(event) => setEarnedXp(event.currentTarget.checked)}
            />
            <span className="text-sm text-foreground">Earned XP</span>
          </label>

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
