import { useRef, useState, type Dispatch, type SetStateAction } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import CreateRaceDialog from "../../../races/components/CreateRaceDialog";
import HeroFormCard from "./edit/HeroFormCard";
import HeroSummaryCard from "./display/cards/HeroSummaryCard";

import type { Item } from "../../../items/types/item-types";
import type { Race } from "../../../races/types/race-types";
import type { Skill } from "../../../skills/types/skill-types";
import type { HeroFormEntry, WarbandHero } from "../../types/warband-types";
import type { HeroValidationError, NewHeroForm } from "../../utils/warband-utils";

type SkillField = {
  key: string;
  label: string;
};

type WarbandHeroesSectionProps = {
  warbandId: number;
  isEditing: boolean;
  isHeroLimitReached: boolean;
  maxHeroes: number;
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
  canAddItems?: boolean;
  canAddSkills?: boolean;
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
  setExpandedHeroId: Dispatch<SetStateAction<number | null>>;
  onToggleHero?: (heroId: number) => void;
  heroErrors?: (HeroValidationError | null)[];
  canEdit?: boolean;
  onEditHeroes?: () => void;
  onSaveHeroes?: () => void;
  onCancelHeroes?: () => void;
  isSavingHeroes?: boolean;
  isLoadingHeroDetails?: boolean;
};

export default function WarbandHeroesSection({
  warbandId,
  isEditing,
  isHeroLimitReached,
  maxHeroes,
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
  canAddItems = false,
  canAddSkills = false,
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
  onToggleHero,
  heroErrors = [],
  canEdit = false,
  onEditHeroes,
  onSaveHeroes,
  onCancelHeroes,
  isSavingHeroes = false,
  isLoadingHeroDetails = false,
}: WarbandHeroesSectionProps) {
  const [isNewRaceListOpen, setIsNewRaceListOpen] = useState(false);
  const raceBlurTimeoutRef = useRef<number | null>(null);

  const handleRaceFocus = () => {
    if (raceBlurTimeoutRef.current !== null) {
      window.clearTimeout(raceBlurTimeoutRef.current);
      raceBlurTimeoutRef.current = null;
    }
    setIsNewRaceListOpen(true);
  };

  const handleRaceBlur = () => {
    raceBlurTimeoutRef.current = window.setTimeout(() => {
      setIsNewRaceListOpen(false);
    }, 120);
  };

  return (
    <CardBackground className="space-y-4 p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-bold" style={{ color: '#a78f79' }}>Heroes</h2>
        <div className="ml-auto flex items-center gap-2">
          {!isEditing && canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEditHeroes}
              disabled={isLoadingHeroDetails}
            >
              {isLoadingHeroDetails ? "Loading..." : "Edit Heroes"}
            </Button>
          ) : null}
          {isEditing && canEdit ? (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={onCancelHeroes}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSaveHeroes}
                disabled={isSavingHeroes}
              >
                {isSavingHeroes ? "Saving..." : "Save"}
              </Button>
            </>
          ) : null}
        </div>
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
              canAddItems={canAddItems}
              canAddSkills={canAddSkills}
              onUpdate={onUpdateHeroForm}
              onRemove={onRemoveHeroForm}
              onItemCreated={onItemCreated}
              onSkillCreated={onSkillCreated}
              onRaceCreated={onRaceCreated}
              error={heroErrors[index] ?? null}
            />
          ))}
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
                <div className="flex items-center gap-2">
                  <Button type="button" onClick={handleAddHero}>
                    Create hero
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
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
                  onFocus={handleRaceFocus}
                  onBlur={handleRaceBlur}
                  actionLabel="Create"
                  actionAriaLabel="Create race"
                  actionVariant="outline"
                  actionClassName="h-8 border-border/60 bg-background/70 text-foreground hover:border-primary/60"
                  onAction={() => setIsRaceDialogOpen(true)}
                />
                  <ActionSearchDropdown open={isNewRaceListOpen} className="mt-1 rounded-xl">
                    <div className="max-h-40 w-full overflow-y-auto p-1">
                      {matchingRaces.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          No matches yet.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {matchingRaces.map((race) => (
                            <button
                              key={race.id}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setNewHeroForm((prev) => ({
                                  ...prev,
                                  race_id: race.id,
                                  race_name: race.name,
                                }));
                                setRaceQuery(race.name);
                                setNewHeroError("");
                                setIsNewRaceListOpen(false);
                              }}
                              className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background/60 px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/60 hover:bg-accent/25"
                            >
                              <span className="font-semibold">{race.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </ActionSearchDropdown>
                  </div>
                </div>
                <div className="min-w-[140px] flex-1 space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Hire cost</Label>
                    <NumberInput
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
                    <NumberInput
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
                <p className="text-xs text-muted-foreground">
                  Maximum of {maxHeroes} heroes reached.
                </p>
              ) : null}
            </div>
          ) : null}
          {isEditing && !isAddingHeroForm ? (
            <div className="flex justify-start">
              <Button
                type="button"
                onClick={() => {
                  setIsAddingHeroForm(true);
                  setNewHeroError("");
                }}
                disabled={isHeroLimitReached}
              >
                Add hero
              </Button>
            </div>
          ) : null}
        </div>
      ) : heroes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No heroes logged yet. Start with your leader and key champions.
        </p>
      ) : (
        <div className="warband-hero-grid">
          {heroes.map((hero) => {
            const isExpanded = expandedHeroId === hero.id;

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
                  warbandId={warbandId}
                  isExpanded={isExpanded}
                  onToggle={() => {
                    if (onToggleHero) {
                      onToggleHero(hero.id);
                      return;
                    }
                    setExpandedHeroId((current) => (current === hero.id ? null : hero.id));
                  }}
                  onCollapse={() => setExpandedHeroId(null)}
                />
              </div>
            );
          })}
        </div>
      )}
    </CardBackground>
  );
}
