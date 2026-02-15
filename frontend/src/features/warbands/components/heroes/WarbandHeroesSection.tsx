import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import AddHeroForm from "./AddHeroForm";
import HeroFormCard from "./edit/HeroFormCard";
import HeroSummaryCard from "./cards/HeroSummaryCard";
import HeroExpandedCard from "./cards/HeroExpandedCard";
import HeroLevelUpControl from "./controls/HeroLevelUpControl";

import type { Item } from "../../../items/types/item-types";
import type { Spell } from "../../../spells/types/spell-types";
import type { Special } from "../../../special/types/special-types";
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
  availableSpells: Spell[];
  availableSpecials: Special[];
  availableRaces: Race[];
  canAddCustom?: boolean;
  itemsError: string;
  skillsError: string;
  spellsError: string;
  specialsError: string;
  racesError: string;
  isItemsLoading: boolean;
  isSkillsLoading: boolean;
  isSpellsLoading: boolean;
  isSpecialsLoading: boolean;
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
  onHeroLevelUp?: (updatedHero: WarbandHero) => void;
  heroErrors?: (HeroValidationError | null)[];
  heroSaveError?: string;
  canEdit?: boolean;
  onEditHeroes?: () => void;
  onSaveHeroes?: () => void;
  onCancelHeroes?: () => void;
  isSavingHeroes?: boolean;
  isLoadingHeroDetails?: boolean;
  onPendingEntryClick?: (heroId: number, tab: "skills" | "spells" | "special") => void;
  pendingEditFocus?: { heroId: number; tab: "skills" | "spells" | "special" } | null;
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
  availableSpells,
  availableSpecials,
  availableRaces,
  canAddCustom = false,
  itemsError,
  skillsError,
  spellsError,
  specialsError,
  racesError,
  isItemsLoading,
  isSkillsLoading,
  isSpellsLoading,
  isSpecialsLoading,
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
  onHeroLevelUp,
  heroErrors = [],
  heroSaveError = "",
  canEdit = false,
  onEditHeroes,
  onSaveHeroes,
  onCancelHeroes,
  isSavingHeroes = false,
  isLoadingHeroDetails = false,
  onPendingEntryClick,
  pendingEditFocus,
}: WarbandHeroesSectionProps) {
  const heroesSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!expandedHeroId) {
      return;
    }
    const node = heroesSectionRef.current;
    if (!node) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [expandedHeroId]);

  return (
    <div ref={heroesSectionRef}>
      <CardBackground
        className={`warband-section-hover ${isEditing ? "warband-section-editing" : ""} space-y-4 p-7`}
      >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-bold" style={{ color: '#a78f79' }}>Heroes</h2>
        <div className="section-edit-actions ml-auto flex items-center gap-2">
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
      {isEditing ? (
        <>
          {isItemsLoading ? (
            <p className="text-xs text-muted-foreground">Loading items...</p>
          ) : null}
          {itemsError ? <p className="text-xs text-red-500">{itemsError}</p> : null}
          {isSkillsLoading ? (
            <p className="text-xs text-muted-foreground">Loading skills...</p>
          ) : null}
          {skillsError ? <p className="text-xs text-red-500">{skillsError}</p> : null}
          {isSpellsLoading ? (
            <p className="text-xs text-muted-foreground">Loading spells...</p>
          ) : null}
          {spellsError ? <p className="text-xs text-red-500">{spellsError}</p> : null}
          {isSpecialsLoading ? (
            <p className="text-xs text-muted-foreground">Loading specials...</p>
          ) : null}
          {specialsError ? <p className="text-xs text-red-500">{specialsError}</p> : null}
          {isRacesLoading ? (
            <p className="text-xs text-muted-foreground">Loading races...</p>
          ) : null}
          {racesError ? <p className="text-xs text-red-500">{racesError}</p> : null}
        </>
      ) : null}
      {heroSaveError ? <p className="text-sm text-red-600">{heroSaveError}</p> : null}
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
              availableSpells={availableSpells}
              availableSpecials={availableSpecials}
              canAddCustom={canAddCustom}
              onUpdate={onUpdateHeroForm}
              onRemove={onRemoveHeroForm}
              onItemCreated={onItemCreated}
              onSkillCreated={onSkillCreated}
              onRaceCreated={onRaceCreated}
              error={heroErrors[index] ?? null}
              initialTab={pendingEditFocus && hero.id === pendingEditFocus.heroId ? pendingEditFocus.tab : undefined}
            />
          ))}
          {isAddingHeroForm ? (
            <AddHeroForm
              campaignId={campaignId}
              newHeroForm={newHeroForm}
              setNewHeroForm={setNewHeroForm}
              newHeroError={newHeroError}
              setNewHeroError={setNewHeroError}
              raceQuery={raceQuery}
              setRaceQuery={setRaceQuery}
              isRaceDialogOpen={isRaceDialogOpen}
              setIsRaceDialogOpen={setIsRaceDialogOpen}
              matchingRaces={matchingRaces}
              onAddHero={handleAddHero}
              isHeroLimitReached={isHeroLimitReached}
              maxHeroes={maxHeroes}
              onCancel={() => {
                setIsAddingHeroForm(false);
                setNewHeroError("");
              }}
              onRaceCreated={onRaceCreated}
            />
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
          No heroes logged yet. Start with your leader.
        </p>
      ) : (
        <div className="space-y-4">
          {expandedHeroId && heroes.find((hero) => hero.id === expandedHeroId) ? (() => {
            const expandedHero = heroes.find((hero) => hero.id === expandedHeroId)!;
            return (
              <HeroExpandedCard
                hero={expandedHero}
                warbandId={warbandId}
                onClose={() => setExpandedHeroId(null)}
                onHeroUpdated={onHeroLevelUp}
                onPendingEntryClick={onPendingEntryClick}
                levelUpControl={canEdit ?
                  <HeroLevelUpControl
                    hero={expandedHero}
                    warbandId={warbandId}
                    onLevelUpLogged={(updatedHero) => {
                      onHeroLevelUp?.(updatedHero);
                    }}
                    trigger={
                      <button
                        type="button"
                        className="level-up-banner level-up-banner--expanded absolute left-1/2 top-0 rounded-full border border-[#6e5a3b] bg-[#3b2a1a] px-4 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-[#f5d97b]"
                      >
                        Level Up!
                      </button>
                    }
                  />
                : undefined}
              />
            );
          })() : null}
          <div className="warband-hero-grid">
            {heroes
              .filter((hero) => hero.id !== expandedHeroId)
              .map((hero) => (
                <div key={hero.id} className="warband-hero-slot">
                  <HeroSummaryCard
                    hero={hero}
                    warbandId={warbandId}
                    isExpanded={false}
                    onHeroUpdated={onHeroLevelUp}
                    onPendingEntryClick={onPendingEntryClick}
                    availableSpells={availableSpells}
                    levelUpControl={canEdit ?
                      <HeroLevelUpControl
                        hero={hero}
                        warbandId={warbandId}
                        onLevelUpLogged={(updatedHero) => {
                          onHeroLevelUp?.(updatedHero);
                        }}
                        trigger={
                          <button
                            type="button"
                            className="level-up-banner absolute left-1/2 top-0 rounded-full border border-[#6e5a3b] bg-[#3b2a1a] px-4 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-[#f5d97b]"
                          >
                            Level Up!
                          </button>
                        }
                      />
                    : undefined}
                    onToggle={() => {
                      if (onToggleHero) {
                        onToggleHero(hero.id);
                        return;
                      }
                      setExpandedHeroId((current) =>
                        current === hero.id ? null : hero.id
                      );
                    }}
                  />
                </div>
              ))}
          </div>
        </div>
      )}
      </CardBackground>
    </div>
  );
}

