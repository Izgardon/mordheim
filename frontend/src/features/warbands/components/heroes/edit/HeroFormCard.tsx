import { useState } from "react";
import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";
import { ExitIcon } from "@components/exit-icon";
import HeroBasicInfo from "./HeroBasicInfo";
import HeroStatsGrid from "./HeroStatsGrid";
import HeroAvailableSkills from "./HeroAvailableSkills";
import HeroLoadout from "./HeroLoadout";
import type { Item } from "../../../../items/types/item-types";
import type { Race } from "../../../../races/types/race-types";
import type { Skill } from "../../../../skills/types/skill-types";
import type { HeroFormEntry } from "../../../types/warband-types";
import type { HeroValidationError } from "../../../utils/warband-utils";

type SkillField = {
  key: string;
  label: string;
};

type HeroFormCardProps = {
  hero: HeroFormEntry;
  index: number;
  campaignId: number;
  statFields: readonly string[];
  skillFields: readonly SkillField[];
  availableRaces: Race[];
  availableItems: Item[];
  availableSkills: Skill[];
  canAddItems?: boolean;
  canAddSkills?: boolean;
  onUpdate: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
  onRemove: (index: number) => void;
  onItemCreated: (index: number, item: Item) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
  onRaceCreated: (race: Race) => void;
  error?: HeroValidationError | null;
};

export default function HeroFormCard({
  hero,
  index,
  campaignId,
  statFields,
  skillFields,
  availableRaces,
  availableItems,
  availableSkills,
  canAddItems = false,
  canAddSkills = false,
  onUpdate,
  onRemove,
  onItemCreated,
  onSkillCreated,
  onRaceCreated,
  error,
}: HeroFormCardProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const heroName = hero.name?.trim() || `Hero ${index + 1}`;

  const handleConfirmRemove = () => {
    setIsRemoveDialogOpen(false);
    onRemove(index);
  };

  const inputClassName =
    "bg-background/70 border-border/60 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50";
  return (
    <div className="relative space-y-4 overflow-visible rounded-2xl border border-border/60 bg-card/80 p-4 text-foreground shadow-[0_18px_40px_rgba(5,20,24,0.45)]">
      <button
        type="button"
        onClick={() => setIsRemoveDialogOpen(true)}
        className="absolute right-2 top-2"
        aria-label="Remove hero"
      >
        <ExitIcon className="h-6 w-6" />
      </button>

      <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <DialogContent className="max-w-[750px]">
          <DialogHeader>
            <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>REMOVE HERO</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove <span className="font-semibold text-foreground">{heroName}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsRemoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRemove}>
              Remove hero
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
        Hero {index + 1}
      </div>

      {error && <p className="text-xs font-semibold text-red-500">{error.message}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <HeroBasicInfo
            hero={hero}
            index={index}
            campaignId={campaignId}
            availableRaces={availableRaces}
            inputClassName={inputClassName}
            onUpdate={onUpdate}
            onRaceCreated={onRaceCreated}
            error={error}
          />

          <HeroStatsGrid
            hero={hero}
            index={index}
            statFields={statFields}
            inputClassName={inputClassName}
            onUpdate={onUpdate}
          />

          <HeroAvailableSkills
            hero={hero}
            index={index}
            skillFields={skillFields}
            onUpdate={onUpdate}
          />
        </div>

        <HeroLoadout
          hero={hero}
          index={index}
          campaignId={campaignId}
          availableItems={availableItems}
          availableSkills={availableSkills}
          inputClassName={inputClassName}
          canAddItems={canAddItems}
          canAddSkills={canAddSkills}
          onUpdate={onUpdate}
          onItemCreated={onItemCreated}
          onSkillCreated={onSkillCreated}
        />
      </div>
    </div>
  );
}
