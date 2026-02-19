import { type Dispatch, type SetStateAction, useState, useRef, useEffect } from "react";

import { Button } from "@components/button";
import WarbandSectionShell from "../shared/sections/WarbandSectionShell";
import AddHeroForm from "./forms/AddHeroForm";
import HeroFormCard from "./forms/HeroFormCard";
import HeroSummaryCard from "./cards/HeroSummaryCard";
import HeroLevelUpControl from "./controls/HeroLevelUpControl";

import type { Item } from "../../../items/types/item-types";
import type { Spell } from "../../../spells/types/spell-types";
import type { Special } from "../../../special/types/special-types";
import type { Race } from "../../../races/types/race-types";
import type { Skill } from "../../../skills/types/skill-types";
import type { HeroFormEntry, WarbandHero } from "../../types/warband-types";
import type { HeroValidationError, NewHeroForm } from "../../utils/warband-utils";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import type { UnitTypeOption } from "@components/unit-selection-section";

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
  layoutVariant?: "default" | "mobile";
  actionsHidden?: boolean;
  onEditHeroes?: () => void;
  onSaveHeroes?: () => void;
  onCancelHeroes?: () => void;
  isSavingHeroes?: boolean;
  isLoadingHeroDetails?: boolean;
  onPendingEntryClick?: (heroId: number, tab: "skills" | "spells" | "special") => void;
  pendingEditFocus?: { heroId: number; tab: "skills" | "spells" | "special" } | null;
  availableGold?: number;
  pendingSpend?: number;
  onPendingPurchaseAdd?: (purchase: PendingPurchase) => void;
  onPendingPurchaseRemove?: (match: { unitType: UnitTypeOption; unitId: string; itemId: number }) => void;
  levelThresholds?: readonly number[];
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
  layoutVariant = "default",
  actionsHidden = false,
  onEditHeroes,
  onSaveHeroes,
  onCancelHeroes,
  isSavingHeroes = false,
  isLoadingHeroDetails = false,
  onPendingEntryClick,
  pendingEditFocus,
  availableGold = 0,
  pendingSpend = 0,
  onPendingPurchaseAdd,
  onPendingPurchaseRemove,
  levelThresholds,
}: WarbandHeroesSectionProps) {
  const isMobileLayout = layoutVariant === "mobile";
  const sectionVariant = isMobileLayout ? "plain" : "card";

  // Keep the slot wide for the duration of the exit animation (200ms) so the
  // expanded card doesn't snap into a narrow column before fading out.
  const [visuallyExpandedSlotId, setVisuallyExpandedSlotId] = useState(expandedHeroId);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (expandedHeroId !== null) {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      setVisuallyExpandedSlotId(expandedHeroId);
    } else {
      collapseTimerRef.current = setTimeout(() => setVisuallyExpandedSlotId(null), 200);
    }
    return () => { if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current); };
  }, [expandedHeroId]);

  const statusNode = isEditing ? (
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
  ) : null;

  const heroCount = isEditing ? heroForms.length : heroes.length;
  const heroCountLabel = `[${heroCount}/${maxHeroes}]`;

  return (
    <div>
      <WarbandSectionShell
        title="Heroes"
        titleSuffix={heroCountLabel}
        isEditing={isEditing}
        canEdit={canEdit}
        variant={sectionVariant}
        className={isMobileLayout ? "px-0" : undefined}
        headerClassName={isMobileLayout ? "gap-2" : undefined}
        actionsHidden={actionsHidden}
        editLabel="Edit Heroes"
        onEdit={onEditHeroes}
        onCancel={onCancelHeroes}
        onSave={onSaveHeroes}
        isSaving={isSavingHeroes}
        isLoadingDetails={isLoadingHeroDetails}
        status={statusNode}
        saveError={heroSaveError}
        pendingSpend={pendingSpend}
        availableGold={availableGold}
      >
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
              deferItemCommit
              reservedGold={pendingSpend}
              onPendingPurchaseAdd={onPendingPurchaseAdd}
              onPendingPurchaseRemove={onPendingPurchaseRemove}
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
          {isMobileLayout ? (
            <div className="space-y-6">
              {heroes.map((hero) => {
                const isExpanded = expandedHeroId === hero.id;
                const levelUpNode = canEdit ? (
                  <HeroLevelUpControl
                    hero={hero}
                    warbandId={warbandId}
                    onLevelUpLogged={(updatedHero) => {
                      onHeroLevelUp?.(updatedHero);
                    }}
                    trigger={
                      <button
                        type="button"
                        className={`level-up-banner${isExpanded ? " level-up-banner--expanded" : ""} absolute left-1/2 top-0 rounded-full border border-[#6e5a3b] bg-[#3b2a1a] px-4 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-[#f5d97b]`}
                      >
                        Level Up!
                      </button>
                    }
                  />
                ) : undefined;

                return (
                  <div key={hero.id} className="space-y-3">
                    <HeroSummaryCard
                      hero={hero}
                      warbandId={warbandId}
                      isExpanded={isExpanded}
                      expandButtonPlacement="bottom"
                      fullWidthItems
                      onHeroUpdated={onHeroLevelUp}
                      onPendingEntryClick={onPendingEntryClick}
                      availableSpells={availableSpells}
                      levelUpControl={levelUpNode}
                      levelThresholds={levelThresholds}
                      layoutVariant="mobile"
                      canEdit={canEdit}
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
                );
              })}
            </div>
          ) : (
            <div className="warband-hero-grid">
              {heroes.map((hero) => {
                const isExpanded = expandedHeroId === hero.id;
                return (
                  <div
                    key={hero.id}
                    className={`warband-hero-slot${visuallyExpandedSlotId === hero.id ? " warband-hero-slot--expanded" : ""}`}
                  >
                    <HeroSummaryCard
                      hero={hero}
                      warbandId={warbandId}
                      isExpanded={isExpanded}
                      onHeroUpdated={onHeroLevelUp}
                      onPendingEntryClick={onPendingEntryClick}
                      availableSpells={availableSpells}
                      levelUpControl={canEdit ? (
                        <HeroLevelUpControl
                          hero={hero}
                          warbandId={warbandId}
                          onLevelUpLogged={(updatedHero) => {
                            onHeroLevelUp?.(updatedHero);
                          }}
                          trigger={
                            <button
                              type="button"
                              className={`level-up-banner${isExpanded ? " level-up-banner--expanded" : ""} absolute left-1/2 top-0 rounded-full border border-[#6e5a3b] bg-[#3b2a1a] px-4 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-[#f5d97b]`}
                            >
                              Level Up!
                            </button>
                          }
                        />
                      ) : undefined}
                      levelThresholds={levelThresholds}
                      layoutVariant="default"
                      canEdit={canEdit}
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
                );
              })}
            </div>
          )}
        </div>
      )}
      
      </WarbandSectionShell>
    </div>
  );
}

