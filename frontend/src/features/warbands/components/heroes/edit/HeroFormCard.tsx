import { useState } from "react";
import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import HeroBasicInfo from "./HeroBasicInfo";
import HeroStatsGrid from "./HeroStatsGrid";
import HeroAvailableSkills from "./HeroAvailableSkills";
import HeroLoadout from "./HeroLoadout";
import type { Item } from "../../../../items/types/item-types";
import type { Spell } from "../../../../spells/types/spell-types";
import type { Feature } from "../../../../features/types/feature-types";
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
  availableSpells: Spell[];
  availableFeatures: Feature[];
  canAddItems?: boolean;
  canAddSkills?: boolean;
  canAddSpells?: boolean;
  canAddFeatures?: boolean;
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
  availableSpells,
  availableFeatures,
  canAddItems = false,
  canAddSkills = false,
  canAddSpells = false,
  canAddFeatures = false,
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
    "bg-background/70 border-border/60 text-foreground placeholder:text-muted-foreground";
  return (
    <div className="relative space-y-4 overflow-visible rounded-2xl border border-border/60 bg-card/80 p-4 text-foreground shadow-[0_18px_40px_rgba(5,20,24,0.45)]">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setIsRemoveDialogOpen(true)}
        className="absolute right-2 top-2"
      >
        Dismiss
      </Button>

      <ConfirmDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        description={
          <span>
            Are you sure you want to dismiss{" "}
            <span className="font-semibold text-foreground">{heroName}</span>? This
            action cannot be undone.
          </span>
        }
        confirmText="Dismiss hero"
        onConfirm={handleConfirmRemove}
        onCancel={() => setIsRemoveDialogOpen(false)}
      />

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
          availableSpells={availableSpells}
          availableFeatures={availableFeatures}
          inputClassName={inputClassName}
          canAddItems={canAddItems}
          canAddSkills={canAddSkills}
          canAddSpells={canAddSpells}
          canAddFeatures={canAddFeatures}
          onUpdate={onUpdate}
          onItemCreated={onItemCreated}
          onSkillCreated={onSkillCreated}
        />
      </div>
    </div>
  );
}

