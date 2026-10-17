import { type Dispatch, type SetStateAction, useState, useRef, useEffect } from "react";

import { Button } from "@components/button";
import WarbandSectionShell from "../shared/sections/WarbandSectionShell";
import UnitFormCard from "../units/UnitFormCard";
import AddUnitForm from "../units/forms/AddUnitForm";
import HeroAddFields from "../units/kinds/hero/HeroAddFields";
import UnitSummaryCard from "../units/UnitSummaryCard";
import UnitLevelUpControl from "../units/UnitLevelUpControl";
import { heroKind } from "../../units/kinds/hero";

import type { Item } from "../../../items/types/item-types";
import type { Spell } from "../../../spells/types/spell-types";
import type { Special } from "../../../special/types/special-types";
import type { Race } from "../../../races/types/race-types";
import type { Skill } from "../../../skills/types/skill-types";
import type { HeroFormEntry, WarbandHero } from "../../types/warband-types";
import type { NewHeroForm } from "../../utils/warband-utils";
import type { UnitValidationError } from "../../units/unit-form-helpers";
import type {
  PendingChangeItem,
  PendingPurchase,
} from "@/features/warbands/utils/pending-purchases";
import type { UnitTypeOption } from "@components/unit-selection-section";
import { getWarbandMobileEditItemId } from "../../hooks/warband/useWarbandMobileTopBar";

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
  handleAddHero: () => Promise<void> | void;
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
  onUpdateHeroForm: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
  onSetLeaderHeroForm: (index: number, isLeader: boolean) => void;
  onRemoveHeroForm: (index: number) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
  onRaceCreated: (race: Race) => void;
  expandedHeroId: number | null;
  setExpandedHeroId: Dispatch<SetStateAction<number | null>>;
  onToggleHero?: (heroId: number) => void;
  onHeroLevelUp?: (updatedHero: WarbandHero) => void;
  heroErrors?: (UnitValidationError | null)[];
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
  pendingChanges?: PendingChangeItem[];
  onPendingPurchaseAdd?: (purchase: PendingPurchase) => void;
  onPendingPurchaseRemove?: (match: {
    unitType: UnitTypeOption;
    unitId: string;
    itemId: number;
  }) => void;
  levelThresholds?: readonly number[];
  maxUnits?: number;
  nonHeroUnitCount?: number;
  showLoadoutOnMobile?: boolean;
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
  onUpdateHeroForm,
  onSetLeaderHeroForm,
  onRemoveHeroForm,
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
  pendingChanges,
  onPendingPurchaseAdd,
  onPendingPurchaseRemove,
  levelThresholds,
  maxUnits,
  nonHeroUnitCount,
  showLoadoutOnMobile = false,
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
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, [expandedHeroId]);

  const statusNode = isEditing ? (
    <>
      {isItemsLoading ? <p className="text-xs text-muted-foreground">Loading items...</p> : null}
      {itemsError ? <p className="text-xs text-red-500">{itemsError}</p> : null}
      {isSkillsLoading ? <p className="text-xs text-muted-foreground">Loading skills...</p> : null}
      {skillsError ? <p className="text-xs text-red-500">{skillsError}</p> : null}
      {isSpellsLoading ? <p className="text-xs text-muted-foreground">Loading spells...</p> : null}
      {spellsError ? <p className="text-xs text-red-500">{spellsError}</p> : null}
      {isSpecialsLoading ? (
        <p className="text-xs text-muted-foreground">Loading specials...</p>
      ) : null}
      {specialsError ? <p className="text-xs text-red-500">{specialsError}</p> : null}
      {isRacesLoading ? <p className="text-xs text-muted-foreground">Loading races...</p> : null}
      {racesError ? <p className="text-xs text-red-500">{racesError}</p> : null}
    </>
  ) : null;

  const heroCount = isEditing ? heroForms.length : heroes.length;
  const heroCountLabel = `[${heroCount}/${maxHeroes}]`;
  const isUnitLimitReached =
    maxUnits !== undefined && heroCount + (nonHeroUnitCount ?? 0) >= maxUnits;
  const isAnyLimitReached = isHeroLimitReached || isUnitLimitReached;

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
        pendingChanges={pendingChanges}
        availableGold={availableGold}
      >
        {isEditing ? (
          <div className="space-y-5">
            {heroForms.map((hero, index) => (
              <div
                key={hero.id ?? `new-${index}`}
                id={getWarbandMobileEditItemId(
                  "heroes",
                  hero.id ? `hero-${hero.id}` : `draft-${index}`
                )}
                className="scroll-mt-28"
              >
                <UnitFormCard
                  kind={heroKind}
                  form={hero}
                  index={index}
                  campaignId={campaignId}
                  availableRaces={availableRaces}
                  availableItems={availableItems}
                  availableSkills={availableSkills}
                  availableSpells={availableSpells}
                  availableSpecials={availableSpecials}
                  canAddCustom={canAddCustom}
                  onUpdate={onUpdateHeroForm}
                  onSetLeader={onSetLeaderHeroForm}
                  onRemove={onRemoveHeroForm}
                  onSkillCreated={onSkillCreated}
                  onRaceCreated={onRaceCreated}
                  deferItemCommit
                  reservedGold={pendingSpend}
                  onPendingPurchaseAdd={onPendingPurchaseAdd}
                  onPendingPurchaseRemove={onPendingPurchaseRemove}
                  error={heroErrors[index] ?? null}
                  initialTab={
                    pendingEditFocus && hero.id === pendingEditFocus.heroId
                      ? pendingEditFocus.tab
                      : undefined
                  }
                />
              </div>
            ))}
            {isAddingHeroForm ? (
              <AddUnitForm
                kind={heroKind}
                onCreate={handleAddHero}
                onCancel={() => {
                  setIsAddingHeroForm(false);
                  setNewHeroError("");
                }}
                error={newHeroError}
                notice={
                  <>
                    {isHeroLimitReached ? (
                      <p className="text-xs text-muted-foreground">
                        Maximum of {maxHeroes} heroes reached.
                      </p>
                    ) : null}
                    {isUnitLimitReached && !isHeroLimitReached ? (
                      <p className="text-xs text-muted-foreground">
                        Warband unit limit of {maxUnits} reached.
                      </p>
                    ) : null}
                  </>
                }
              >
                <HeroAddFields
                  campaignId={campaignId}
                  form={newHeroForm}
                  setForm={setNewHeroForm}
                  setError={setNewHeroError}
                  raceQuery={raceQuery}
                  setRaceQuery={setRaceQuery}
                  races={availableRaces}
                  onRaceCreated={onRaceCreated}
                />
              </AddUnitForm>
            ) : null}
            {isEditing && !isAddingHeroForm ? (
              <div id={getWarbandMobileEditItemId("heroes", "add-new")} className="scroll-mt-28">
                <div className="flex justify-start">
                  <Button
                    type="button"
                    onClick={() => {
                      setIsAddingHeroForm(true);
                      setNewHeroError("");
                    }}
                    disabled={isAnyLimitReached}
                  >
                    Add hero
                  </Button>
                </div>
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
              <div className="space-y-10">
                {heroes.map((hero) => {
                  const isExpanded = expandedHeroId === hero.id;
                  const levelUpNode = canEdit ? (
                    <UnitLevelUpControl
                      kind={heroKind}
                      unit={hero}
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
                    <div key={hero.id} className="space-y-5">
                      <UnitSummaryCard
                        kind={heroKind}
                        unit={hero}
                        warbandId={warbandId}
                        isExpanded={isExpanded}
                        expandButtonPlacement="bottom"
                        fullWidthItems
                        onUnitUpdated={onHeroLevelUp}
                        onPendingEntryClick={onPendingEntryClick}
                        availableSpells={availableSpells}
                        levelUpControl={levelUpNode}
                        levelThresholds={levelThresholds}
                        layoutVariant="mobile"
                        showLoadoutOnMobile={showLoadoutOnMobile}
                        canEdit={canEdit}
                        onToggle={() => {
                          if (onToggleHero) {
                            onToggleHero(hero.id);
                            return;
                          }
                          setExpandedHeroId((current) => (current === hero.id ? null : hero.id));
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
                      <UnitSummaryCard
                        kind={heroKind}
                        unit={hero}
                        warbandId={warbandId}
                        isExpanded={isExpanded}
                        onUnitUpdated={onHeroLevelUp}
                        onPendingEntryClick={onPendingEntryClick}
                        availableSpells={availableSpells}
                        levelUpControl={
                          canEdit ? (
                            <UnitLevelUpControl
                              kind={heroKind}
                              unit={hero}
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
                          ) : undefined
                        }
                        levelThresholds={levelThresholds}
                        layoutVariant="default"
                        canEdit={canEdit}
                        onToggle={() => {
                          if (onToggleHero) {
                            onToggleHero(hero.id);
                            return;
                          }
                          setExpandedHeroId((current) => (current === hero.id ? null : hero.id));
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
