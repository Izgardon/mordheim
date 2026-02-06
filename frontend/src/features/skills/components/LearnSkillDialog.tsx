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
import skillIcon from "@/assets/components/skill.webp";

// types
import type { WarbandHero } from "@/features/warbands/types/warband-types";
import type { Skill } from "../types/skill-types";

export type UnitType = "heroes" | "henchmen" | "hiredswords";

type LearnSkillDialogProps = {
  skill: Skill;
  unitTypes: UnitType[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const unitTypeLabels: Record<UnitType, string> = {
  heroes: "Heroes",
  henchmen: "Henchmen",
  hiredswords: "Hired Swords",
};

const unitSelectLabels: Record<UnitType, string> = {
  heroes: "Hero",
  henchmen: "Henchmen Group",
  hiredswords: "Hired Sword",
};

export default function LearnSkillDialog({
  skill,
  unitTypes,
  trigger,
  open: openProp,
  onOpenChange,
}: LearnSkillDialogProps) {
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

  const handleLearn = async () => {
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
      const existingSkillIds = (hero.skills ?? []).map((s) => s.id);
      await updateWarbandHero(warband.id, heroId, {
        skill_ids: [...existingSkillIds, skill.id],
      } as any);
      handleOpenChange(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Failed to learn skill");
      } else {
        setError("Failed to learn skill");
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

    switch (selectedUnitType) {
      case "heroes":
        return warband.heroes ?? [];
      case "henchmen":
        // Future: return warband.henchmen ?? [];
        return [];
      case "hiredswords":
        // Future: return warband.hiredswords ?? [];
        return [];
      default:
        return [];
    }
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
            aria-label="Learn skill"
            className="icon-button h-8 w-8 shrink-0 transition-[filter] hover:brightness-125"
          >
            <img
              src={skillIcon}
              alt=""
              className="h-full w-full object-contain"
            />
          </button>
        }
        content="Learn Skill"
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
        <DialogTitle className="sr-only">Learn skill</DialogTitle>
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          className="icon-button absolute right-2 top-2 transition-[filter] hover:brightness-125"
          aria-label="Close"
        >
          <ExitIcon className="h-6 w-6" />
        </button>
        <p className="text-center text-lg text-muted-foreground">
          Learning:{" "}
          <Tooltip
            trigger={
              <span className="cursor-help font-medium text-foreground underline decoration-dotted underline-offset-2">
                {skill.name}
              </span>
            }
            content={
              <div className="space-y-2 not-italic">
                <p className="font-bold text-foreground">{skill.name}</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {skill.type}
                </p>
                {skill.description && (
                  <p className="text-sm">{skill.description}</p>
                )}
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
                <SelectValue placeholder={`Select ${unitSelectLabel.toLowerCase()}`} />
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
            onClick={handleLearn}
            disabled={isSubmitting || !selectedUnitId}
          >
            {isSubmitting ? "Learning..." : "Learn"}
          </Button>
        </div>
      </SimpleDialogContent>
    </Dialog>
  );
}
