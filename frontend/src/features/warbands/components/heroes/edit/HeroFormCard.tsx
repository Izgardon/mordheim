import { useState } from "react";
import { Button } from "@components/button";
import { Label } from "@components/label";
import { ConfirmDialog } from "@components/confirm-dialog";
import HeroBasicInfo from "./HeroBasicInfo";
import HeroStatsGrid from "./HeroStatsGrid";
import HeroLoadout from "./HeroLoadout";
import type { Item } from "../../../../items/types/item-types";
import type { Spell } from "../../../../spells/types/spell-types";
import type { Special } from "../../../../special/types/special-types";
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
  availableSpecials: Special[];
  canAddCustom?: boolean;
  onUpdate: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
  onRemove: (index: number) => void;
  onItemCreated: (index: number, item: Item) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
  onRaceCreated: (race: Race) => void;
  error?: HeroValidationError | null;
  initialTab?: "items" | "skills" | "spells" | "special";
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
  availableSpecials,
  canAddCustom = false,
  onUpdate,
  onRemove,
  onItemCreated,
  onSkillCreated,
  onRaceCreated,
  error,
  initialTab,
}: HeroFormCardProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isDeedsOpen, setIsDeedsOpen] = useState(false);
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
            availableSpecials={availableSpecials}
            availableSkills={availableSkills}
            skillFields={skillFields}
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

          <div className="space-y-2 rounded border border-border/60 bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-semibold text-foreground">Deeds</Label>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setIsDeedsOpen((current) => !current)}
              >
                {isDeedsOpen ? "Hide" : "Show"}
              </button>
            </div>
            {isDeedsOpen ? (
              <textarea
                value={hero.deeds}
                onChange={(event) =>
                  onUpdate(index, (current) => ({
                    ...current,
                    deeds: event.target.value,
                  }))
                }
                placeholder="Notable deeds, achievements, and scars..."
                rows={4}
                className={[
                  "min-h-[110px] w-full border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)]",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ) : null}
          </div>
        </div>

        <HeroLoadout
          hero={hero}
          index={index}
          campaignId={campaignId}
          availableItems={availableItems}
          availableSkills={availableSkills}
          availableSpells={availableSpells}
          availableSpecials={availableSpecials}
          inputClassName={inputClassName}
          canAddCustom={canAddCustom}
          onUpdate={onUpdate}
          onItemCreated={onItemCreated}
          onSkillCreated={onSkillCreated}
          initialTab={initialTab}
        />
      </div>
    </div>
  );
}

