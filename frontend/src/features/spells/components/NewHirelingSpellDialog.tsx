import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@components/button";
import { Dialog, DialogContent, DialogTitle } from "@components/dialog";
import { Label } from "@components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import DiceRoller from "@/components/dice/DiceRoller";

import { useAppStore } from "@/stores/app-store";

import { useCatalogue } from "@/lib/catalogue-queries";
import { updateWarbandHireling } from "@/features/warbands/api/warbands-api";
import {
  buildSpellCountMap,
  getAdjustedSpellDc,
  getSpellDisplayName,
} from "@/features/warbands/utils/spell-display";

import type { WarbandHireling } from "@/features/warbands/types/warband-types";

type NewHirelingSpellDialogProps = {
  hireling: WarbandHireling;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHirelingUpdated?: (updated: WarbandHireling) => void;
};

export default function NewHirelingSpellDialog({
  hireling,
  warbandId,
  open,
  onOpenChange,
  onHirelingUpdated,
}: NewHirelingSpellDialogProps) {
  const { warband, diceColor } = useAppStore();
  const [selectedType, setSelectedType] = useState("");
  const [selectedSpellId, setSelectedSpellId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rolling, setRolling] = useState(false);
  const [rollSignal, setRollSignal] = useState(0);

  const campaignId = warband?.campaign_id;

  // The campaign's spells list, shared with the rest of the app and fetched on first open.
  const { data: allSpells } = useCatalogue("spells", campaignId, { enabled: open });

  const knownTypes = useMemo(
    () => [
      ...new Set(
        (hireling.spells ?? [])
          .map((s) => s.type)
          .filter((t): t is string => !!t && t !== "Pending")
      ),
    ],
    [hireling.spells]
  );

  const allTypes = useMemo(
    () => [
      ...new Set(allSpells.map((s) => s.type).filter((t): t is string => !!t && t !== "Pending")),
    ],
    [allSpells]
  );

  const knownTypeSet = useMemo(() => new Set(knownTypes), [knownTypes]);
  const otherTypes = useMemo(
    () => allTypes.filter((t) => !knownTypeSet.has(t)),
    [allTypes, knownTypeSet]
  );

  useEffect(() => {
    if (open && knownTypes.length > 0 && !selectedType) {
      setSelectedType(knownTypes[0]);
    }
  }, [open, knownTypes, selectedType]);

  const unitSpellsForType = useMemo(
    () => (hireling.spells ?? []).filter((s) => s.type === selectedType && s.type !== "Pending"),
    [hireling.spells, selectedType]
  );
  const spellCounts = useMemo(() => buildSpellCountMap(hireling.spells ?? []), [hireling.spells]);

  const typeSpells = useMemo(
    () =>
      allSpells
        .filter((s) => s.type === selectedType)
        .sort((a, b) => (a.roll ?? 0) - (b.roll ?? 0)),
    [allSpells, selectedType]
  );

  const selectedSpell = useMemo(
    () => typeSpells.find((s) => String(s.id) === selectedSpellId) ?? null,
    [typeSpells, selectedSpellId]
  );
  const selectedSpellDisplay = useMemo(() => {
    if (!selectedSpell) return null;
    return {
      name: getSpellDisplayName(selectedSpell, spellCounts),
      dc: getAdjustedSpellDc(selectedSpell.dc, selectedSpell, spellCounts),
    };
  }, [selectedSpell, spellCounts]);

  const alreadyKnown = useMemo(() => {
    if (!selectedSpell) return false;
    return (hireling.spells ?? []).some((s) => s.id === selectedSpell.id && s.type !== "Pending");
  }, [hireling.spells, selectedSpell]);

  const typeSpellsRef = useMemo(() => typeSpells, [typeSpells]);

  const handleDiceTotal = useCallback(
    (total: number) => {
      const match = typeSpellsRef.find((s) => s.roll === total);
      if (match) {
        setSelectedSpellId(String(match.id));
      }
    },
    [typeSpellsRef]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSelectedType("");
      setSelectedSpellId("");
      setError("");
      setRolling(false);
      setRollSignal(0);
    }
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setSelectedSpellId("");
  };

  const handleAttune = async () => {
    if (!selectedSpell) return;

    setIsSubmitting(true);
    setError("");

    try {
      const existingSpellIds = (hireling.spells ?? [])
        .filter((s) => s.type !== "Pending")
        .map((s) => s.id);
      const pendingSpells = (hireling.spells ?? []).filter((s) => s.type === "Pending");
      const pendingIds = pendingSpells.slice(1).map((s) => s.id);

      // The PATCH answers with the hired sword as saved: no GET after it.
      const updated = await updateWarbandHireling(warbandId, hireling.id, {
        spell_ids: [...existingSpellIds, ...pendingIds, selectedSpell.id],
      });
      onHirelingUpdated?.(updated);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to learn spell");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogTitle className="text-center">Learn New Spell</DialogTitle>

        <div className="space-y-2">
          <Label>Spell List</Label>
          <Select value={selectedType} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select spell list" />
            </SelectTrigger>
            <SelectContent>
              {knownTypes.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[#f5d97b]">Known Spell Lists</SelectLabel>
                  {knownTypes.map((type) => (
                    <SelectItem key={type} value={type} className="text-[#f5d97b]">
                      {type}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {knownTypes.length > 0 && otherTypes.length > 0 && <SelectSeparator />}
              {otherTypes.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Other Spell Lists</SelectLabel>
                  {otherTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          {selectedType && unitSpellsForType.length > 0 && (
            <div className="max-h-[100px] overflow-y-auto rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs">
              {unitSpellsForType.map((spell, i) => {
                const displayName = getSpellDisplayName(spell, spellCounts);
                const displayDc = getAdjustedSpellDc(spell.dc, spell, spellCounts);
                return (
                  <div
                    key={`${spell.id}-${i}`}
                    className="flex items-center justify-between gap-2 py-0.5 text-muted-foreground"
                  >
                    <span className="min-w-0 truncate">
                      {spell.roll != null ? `${spell.roll}. ` : ""}
                      {displayName}
                    </span>
                    {displayDc != null && displayDc !== "" && (
                      <span className="shrink-0 text-muted-foreground/70">DC {displayDc}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-end gap-3">
          <div className="shrink-0">
            <DiceRoller
              mode="fixed"
              fixedNotation="1d6"
              variant="button-only"
              showResultBox={false}
              themeColor={diceColor}
              rollButtonPrefix=""
              rollSignal={rollSignal}
              rollDisabled={!selectedType || rolling}
              onTotalChange={handleDiceTotal}
              onRollingChange={setRolling}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Label>Spell</Label>
            <Select
              value={selectedSpellId}
              onValueChange={setSelectedSpellId}
              disabled={!selectedType || typeSpells.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={typeSpells.length === 0 ? "No spells" : "Select spell"} />
              </SelectTrigger>
              <SelectContent>
                {typeSpells.map((spell) => (
                  <SelectItem key={spell.id} value={String(spell.id)}>
                    {spell.roll != null ? `${spell.roll}. ` : ""}
                    {spell.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-[120px] overflow-y-auto rounded border border-white/10 bg-white/5 px-3 py-2 text-sm">
          {selectedSpell ? (
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{selectedSpellDisplay?.name}</p>
              {selectedSpellDisplay?.dc != null && selectedSpellDisplay.dc !== "" && (
                <p className="text-xs text-muted-foreground">
                  Difficulty: {selectedSpellDisplay.dc}
                </p>
              )}
              {selectedSpell.description && (
                <p className="text-muted-foreground">{selectedSpell.description}</p>
              )}
              {alreadyKnown && (
                <p className="mt-1 text-xs text-[#f5d97b]">
                  This hired sword already knows this spell.
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground/50">Select a spell to see its details.</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleAttune} disabled={isSubmitting || !selectedSpell}>
            {isSubmitting ? "Learning..." : "Learn Spell"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
