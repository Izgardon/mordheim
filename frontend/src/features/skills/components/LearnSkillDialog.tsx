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
import { Tooltip } from "@components/tooltip";
import {
  UnitSelectionSection,
  type UnitTypeOption,
} from "@components/unit-selection-section";

// stores
import { useAppStore } from "@/stores/app-store";

// api
import { updateWarbandHero } from "@/features/warbands/api/warbands-api";

// assets
import skillIcon from "@/assets/components/skill.webp";

// types
import type { Skill } from "../types/skill-types";

type LearnSkillDialogProps = {
  skill: Skill;
  unitTypes: UnitTypeOption[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function LearnSkillDialog({
  skill,
  unitTypes,
  trigger,
  open: openProp,
  onOpenChange,
}: LearnSkillDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedUnitType, setSelectedUnitType] = useState<UnitTypeOption | "">("");
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

  const units = useMemo(() => {
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
      case "stash":
        return [];
      default:
        return [];
    }
  }, [warband, selectedUnitType]);

  const handleUnitTypeChange = (value: UnitTypeOption | "") => {
    setSelectedUnitType(value);
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

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {triggerNode !== null ? (
        <DialogTrigger asChild>{triggerNode}</DialogTrigger>
      ) : null}
      <SimpleDialogContent className="max-w-[480px]">
        <DialogTitle className="sr-only">Learn skill</DialogTitle>
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          className="icon-button absolute right-1 top-1 transition-[filter] hover:brightness-125"
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
        <UnitSelectionSection
          unitTypes={unitTypes}
          selectedUnitType={selectedUnitType}
          selectedUnitId={selectedUnitId}
          onUnitTypeChange={handleUnitTypeChange}
          onUnitIdChange={setSelectedUnitId}
          units={units}
          error={error}
        />
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
