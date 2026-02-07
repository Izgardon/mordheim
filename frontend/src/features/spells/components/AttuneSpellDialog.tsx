import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// components
import { Button } from "@components/button";
import {
  Dialog,
  DialogTrigger,
  SimpleDialogContent,
  DialogTitle,
} from "@components/dialog";
import { ExitIcon } from "@components/exit-icon";
import { Label } from "@components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import { Tooltip } from "@components/tooltip";

// stores
import { useAppStore } from "@/stores/app-store";

// api
import { updateWarbandHero } from "@/features/warbands/api/warbands-api";

// assets
import spellIcon from "@/assets/components/spell.webp";

// types
import type { WarbandHero } from "@/features/warbands/types/warband-types";
import type { Spell } from "../types/spell-types";

export type UnitType = "heroes" | "hiredswords";

type AttuneSpellDialogProps = {
  spell: Spell;
  unitTypes: UnitType[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const unitTypeLabels: Record<UnitType, string> = {
  heroes: "Heroes",
  hiredswords: "Hired Swords",
};

const unitSelectLabels: Record<UnitType, string> = {
  heroes: "Hero",
  hiredswords: "Hired Sword",
};

export default function AttuneSpellDialog({
  spell,
  unitTypes,
  trigger,
  open: openProp,
  onOpenChange,
}: AttuneSpellDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedUnitType, setSelectedUnitType] = useState<UnitType | "">("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { warband } = useAppStore();

  const resolvedOpen = openProp ?? open;
  const setResolvedOpen = (nextOpen: boolean) => {
    if (openProp === undefined) {
      setOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setResolvedOpen(nextOpen);
    if (!nextOpen) {
      setSelectedUnitType("");
      setSelectedUnitId("");
      setError("");
    }
  };

  const handleAttune = async () => {
    if (!warband || !selectedUnitId) {
      return;
    }

    const heroId = Number(selectedUnitId);
    const hero = units.find((u) => u.id === heroId);
    if (!hero) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const existingSpellIds = (hero.spells ?? []).map((s) => s.id);
      await updateWarbandHero(warband.id, heroId, {
        spell_ids: [...existingSpellIds, spell.id],
      } as any);
      handleOpenChange(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Failed to attune spell");
      } else {
        setError("Failed to attune spell");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (resolvedOpen && unitTypes.length > 0 && !selectedUnitType) {
      setSelectedUnitType(unitTypes[0]);
    }
  }, [resolvedOpen, unitTypes, selectedUnitType]);

  const units = useMemo<WarbandHero[]>(() => {
    if (!warband || !selectedUnitType) {
      return [];
    }

    let allUnits: WarbandHero[] = [];
    switch (selectedUnitType) {
      case "heroes":
        allUnits = warband.heroes ?? [];
        break;
      case "hiredswords":
        // Future: allUnits = warband.hiredswords ?? [];
        allUnits = [];
        break;
      default:
        allUnits = [];
    }

    // Filter to only casters
    return allUnits.filter((unit) => unit.caster === true);
  }, [warband, selectedUnitType]);

  const handleUnitTypeChange = (value: string) => {
    setSelectedUnitType(value as UnitType);
    setSelectedUnitId("");
  };

  const triggerNode =
    trigger === undefined ? (
      <Tooltip
        trigger={
          <button
            type="button"
            aria-label="Attune spell"
            className="icon-button h-8 w-8 shrink-0 transition-[filter] hover:brightness-125"
          >
            <img
              src={spellIcon}
              alt=""
              className="h-full w-full object-contain"
            />
          </button>
        }
        content="Attune Spell"
      />
    ) : (
      trigger
    );

  const unitSelectLabel = selectedUnitType ? unitSelectLabels[selectedUnitType] : "Unit";

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? (
        <DialogTrigger asChild>{triggerNode}</DialogTrigger>
      ) : null}
      <SimpleDialogContent className="max-w-[400px]">
        <DialogTitle className="sr-only">Attune spell</DialogTitle>
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          className="icon-button absolute right-1 top-1 transition-[filter] hover:brightness-125"
          aria-label="Close"
        >
          <ExitIcon className="h-6 w-6" />
        </button>
        <p className="text-center text-base text-muted-foreground">
          Attuning:{" "}
          <Tooltip
            trigger={
              <span className="cursor-help font-medium text-foreground underline decoration-dotted underline-offset-2">
                {spell.name}
              </span>
            }
            content={
              <div className="space-y-2 not-italic">
                <p className="font-bold text-foreground">{spell.name}</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {spell.type || "Spell"}
                </p>
                {spell.description && (
                  <p className="text-sm">{spell.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  {spell.roll != null && <span>D6: {spell.roll}</span>}
                  {spell.dc != null && <span>Difficulty: {spell.dc}</span>}
                </div>
              </div>
            }
            maxWidth={360}
          />
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Unit Type</Label>
            <Select value={selectedUnitType} onValueChange={handleUnitTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {unitTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {unitTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{unitSelectLabel}</Label>
            <Select
              value={selectedUnitId}
              onValueChange={setSelectedUnitId}
              disabled={!selectedUnitType || units.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={units.length === 0 ? "No casters" : `Select ${unitSelectLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={String(unit.id)}>
                    {unit.name ?? "Unnamed"} — {unit.unit_type ?? "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <Button
            onClick={handleAttune}
            disabled={isSubmitting || !selectedUnitId}
          >
            {isSubmitting ? "Attuning..." : "Attune"}
          </Button>
        </div>
      </SimpleDialogContent>
    </Dialog>
  );
}
