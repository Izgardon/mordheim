import type { Dispatch, SetStateAction } from "react";

import { Button } from "@components/button";
import { Input } from "@components/input";
import { Label } from "@components/label";
import { ActionSearchInput } from "@components/action-search-input";
import CreateRaceDialog from "../../../races/components/CreateRaceDialog";
import HeroFormCard from "./HeroFormCard";
import HeroSummaryCard from "./HeroSummaryCard";

import type { Item } from "../../../items/types/item-types";
import type { Race } from "../../../races/types/race-types";
import type { Skill } from "../../../skills/types/skill-types";
import type { HeroFormEntry, WarbandHero } from "../../types/warband-types";
import type { NewHeroForm } from "../../utils/warband-utils";

type SkillField = {
  key: string;
  label: string;
};

type WarbandHeroesSectionProps = {
  isEditing: boolean;
  isHeroLimitReached: boolean;
  isAddingHeroForm: boolean;
  setIsAddingHeroForm: (value: boolean) => void;
  newHeroForm: NewHeroForm;
  setNewHeroForm: Dispatch<SetStateAction<NewHeroForm>>;
  newHeroError: string;
  setNewHeroError: (value: string) => void;
  raceQuery: string;
  setRaceQuery: (value: string) => void;
  isRaceDialogOpen: boolean;
  setIsRaceDialogOpen: (value: boolean) => void;
  matchingRaces: Race[];
  handleAddHero: () => void;
  heroForms: HeroFormEntry[];
  heroes: WarbandHero[];
  availableItems: Item[];
  availableSkills: Skill[];
  availableRaces: Race[];
  itemsError: string;
  skillsError: string;
  racesError: string;
  isItemsLoading: boolean;
  isSkillsLoading: boolean;
  isRacesLoading: boolean;
  campaignId: number;
  statFields: readonly string[];
  skillFields: readonly SkillField[];
  onUpdateHeroForm: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
  onRemoveHeroForm: (index: number) => void;
  onItemCreated: (index: number, item: Item) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
  onRaceCreated: (race: Race) => void;
  expandedHeroId: number | null;
  setExpandedHeroId: (value: number | null) => void;
};

export default function WarbandHeroesSection({
  isEditing,
  isHeroLimitReached,
  isAddingHeroForm,
  setIsAddingHeroForm,
  newHeroForm,
  setNewHeroForm,
  newHeroError,
  setNewHeroError,
  raceQuery,
  setRaceQuery,
  isRaceDialogOpen,
  setIsRaceDialogOpen,
  matchingRaces,
  handleAddHero,
  heroForms,
  heroes,
  availableItems,
  availableSkills,
  availableRaces,
  itemsError,
  skillsError,
  racesError,
  isItemsLoading,
  isSkillsLoading,
  isRacesLoading,
  campaignId,
  statFields,
  skillFields,
  onUpdateHeroForm,
  onRemoveHeroForm,
  onItemCreated,
  onSkillCreated,
  onRaceCreated,
  expandedHeroId,
  setExpandedHeroId,
}: WarbandHeroesSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">heroes</h2>
        {isEditing ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setIsAddingHeroForm(true);
              setNewHeroError("");
            }}
            disabled={isHeroLimitReached}
          >
            Add hero
          </Button>
        ) : null}
      </div>
      {isItemsLoading ? (
        <p className="text-xs text-muted-foreground">Loading items...</p>
      ) : null}
      {itemsError ? <p className="text-xs text-red-500">{itemsError}</p> : null}
      {isSkillsLoading ? (
        <p className="text-xs text-muted-foreground">Loading skills...</p>
      ) : null}
      {skillsError ? <p className="text-xs text-red-500">{skillsError}</p> : null}
      {isRacesLoading ? (
        <p className="text-xs text-muted-foreground">Loading races...</p>
      ) : null}
      {racesError ? <p className="text-xs text-red-500">{racesError}</p> : null}
      {isEditing ? (
        <div className="space-y-5">
          {isAddingHeroForm ? (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4 text-foreground shadow-[0_16px_32px_rgba(5,20,24,0.3)]">
              <CreateRaceDialog
                campaignId={campaignId}
                onCreated={(race) => {
                  onRaceCreated(race);
                  setNewHeroForm((prev) => ({
                    ...prev,
                    race_id: race.id,
                    race_name: race.name,
                  }));
                  setRaceQuery(race.name);
                  setNewHeroError("");
                }}
                open={isRaceDialogOpen}
                onOpenChange={setIsRaceDialogOpen}
                trigger={null}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold text-accent">new hero</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" onClick={handleAddHero}>
                    Create hero
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingHeroForm(false);
                      setNewHeroError("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="min-w-[180px] flex-1 space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Name</Label>
                  <Input
                    value={newHeroForm.name}
                    onChange={(event) => {
                      setNewHeroForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }));
                      setNewHeroError("");
                    }}
                    placeholder="Hero name"
                  />
                </div>
                <div className="min-w-[160px] flex-1 space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Type</Label>
                  <Input
                    value={newHeroForm.unit_type}
                    onChange={(event) => {
                      setNewHeroForm((prev) => ({
                        ...prev,
                        unit_type: event.target.value,
                      }));
                      setNewHeroError("");
                    }}
                    placeholder="Leader, Champion"
                  />
                </div>
                <div className="min-w-[200px] flex-[1.2] space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Race</Label>
                  <div className="relative">
                    <ActionSearchInput
                      value={raceQuery}
                      onChange={(event) => {
                        const value = event.target.value;
                        setRaceQuery(value);
                        setNewHeroForm((prev) => ({
                          ...prev,
                          race_id: null,
                          race_name: "",
                        }));
                        setNewHeroError("");
                      }}
                      placeholder="Search races..."
                      actionLabel="Create"
                      actionAriaLabel="Create race"
                      actionVariant="outline"
                      actionClassName="h-8 border-border/60 bg-background/70 text-foreground hover:border-primary/60"
                      onAction={() => setIsRaceDialogOpen(true)}
                    />
                    {matchingRaces.length > 0 ? (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-background/95 p-1 shadow-[0_12px_30px_rgba(5,20,24,0.35)]">
                        {matchingRaces.map((race) => (
                          <button
                            key={race.id}
                            type="button"
                            onClick={() => {
                              setNewHeroForm((prev) => ({
                                ...prev,
                                race_id: race.id,
                                race_name: race.name,
                              }));
                              setRaceQuery(race.name);
                              setNewHeroError("");
                            }}
                            className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background/60 px-3 py-2 text-left text-xs text-foreground hover:border-primary/60"
                          >
                            <span className="font-semibold">{race.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="min-w-[140px] flex-1 space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Hire cost</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newHeroForm.price}
                    onChange={(event) =>
                      setNewHeroForm((prev) => ({
                        ...prev,
                        price: event.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
                <div className="min-w-[140px] flex-1 space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Experience</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newHeroForm.xp}
                    onChange={(event) =>
                      setNewHeroForm((prev) => ({
                        ...prev,
                        xp: event.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>
              {newHeroError ? <p className="text-sm text-red-600">{newHeroError}</p> : null}
              {isHeroLimitReached ? (
                <p className="text-xs text-muted-foreground">Maximum of 6 heroes reached.</p>
              ) : null}
            </div>
          ) : null}
          {heroForms.map((hero, index) => (
            <HeroFormCard
              key={hero.id ?? `new-${index}`}
              hero={hero}
              index={index}
              campaignId={campaignId}
              statFields={statFields}
              skillFields={skillFields}
              availableRaces={availableRaces}
              availableItems={availableItems}
              availableSkills={availableSkills}
              onUpdate={onUpdateHeroForm}
              onRemove={onRemoveHeroForm}
              onItemCreated={onItemCreated}
              onSkillCreated={onSkillCreated}
              onRaceCreated={onRaceCreated}
            />
          ))}
        </div>
      ) : heroes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No heroes logged yet. Start with your leader and key champions.
        </p>
      ) : (
        <div className="warband-hero-grid">
          {heroes.map((hero, index) => {
            const isExpanded = expandedHeroId === hero.id;
            const columnIndexSm = index % 2;
            const columnIndexXl = index % 3;
            const overlayOffsetClass = [
              columnIndexSm === 0 ? "sm:left-0" : "sm:-left-[calc(100%+1rem)]",
              columnIndexXl === 0
                ? "xl:left-0"
                : columnIndexXl === 1
                  ? "xl:-left-[calc(100%+1rem)]"
                  : "xl:-left-[calc(200%+2rem)]",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={hero.id}
                className={[
                  "warband-hero-slot",
                  isExpanded ? "warband-hero-slot--expanded" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <HeroSummaryCard
                  hero={hero}
                  isExpanded={isExpanded}
                  overlayClassName={overlayOffsetClass}
                  onToggle={() =>
                    setExpandedHeroId((current) => (current === hero.id ? null : hero.id))
                  }
                  onCollapse={() => setExpandedHeroId(null)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

