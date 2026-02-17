import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@components/button";
import WarbandSectionShell from "../shared/sections/WarbandSectionShell";
import AddHiredSwordForm from "./forms/AddHiredSwordForm";
import HiredSwordFormCard from "./forms/HiredSwordFormCard";
import HiredSwordSummaryCard from "./cards/HiredSwordSummaryCard";
import HiredSwordExpandedCard from "./cards/HiredSwordExpandedCard";
import HiredSwordLevelUpControl from "./controls/HiredSwordLevelUpControl";

import { useHiredSwordForms } from "../../hooks/hiredswords/useHiredSwordForms";
import { useHiredSwordCreationForm } from "../../hooks/hiredswords/useHiredSwordCreationForm";
import { useWarbandHiredSwordsSave } from "../../hooks/hiredswords/useWarbandHiredSwordsSave";
import { listWarbandHiredSwordDetails, listWarbandHiredSwords } from "../../api/warbands-api";
import { mapHiredSwordToForm, validateHiredSwordForm } from "../../utils/warband-utils";
import { getPendingSpend, removePendingPurchase, type PendingPurchase } from "../../utils/pending-purchases";

import type { Item } from "../../../items/types/item-types";
import type { Special } from "../../../special/types/special-types";
import type { Race } from "../../../races/types/race-types";
import type { Skill } from "../../../skills/types/skill-types";
import type { Spell } from "../../../spells/types/spell-types";
import type { WarbandHiredSword } from "../../types/warband-types";

type SkillField = {
  key: string;
  label: string;
};

type WarbandHiredSwordsSectionProps = {
  warbandId: number;
  canEdit: boolean;
  maxHiredSwords: number;
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpells: Spell[];
  availableSpecials: Special[];
  availableRaces: Race[];
  canAddCustom?: boolean;
  onItemCreated: (index: number, item: Item) => void;
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
  onRaceCreated: (race: Race) => void;
  onHiredSwordUpdated?: (updated: WarbandHiredSword) => void;
  onHiredSwordsChange?: (hiredSwords: WarbandHiredSword[]) => void;
  availableGold: number;
  levelThresholds?: readonly number[];
  layoutVariant?: "default" | "mobile";
};

export default function WarbandHiredSwordsSection({
  warbandId,
  canEdit,
  maxHiredSwords,
  availableItems,
  availableSkills,
  availableSpells,
  availableSpecials,
  availableRaces,
  canAddCustom = false,
  onItemCreated,
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
  onRaceCreated,
  onHiredSwordUpdated,
  onHiredSwordsChange,
  availableGold,
  levelThresholds,
  layoutVariant = "default",
}: WarbandHiredSwordsSectionProps) {
  const [hiredSwords, setHiredSwords] = useState<WarbandHiredSword[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [pendingEditFocus, setPendingEditFocus] = useState<{ hiredSwordId: number; tab: "skills" | "spells" | "special" } | null>(null);
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const isMobileLayout = layoutVariant === "mobile";
  const sectionVariant = isMobileLayout ? "plain" : "card";

  useEffect(() => {
    if (!warbandId) return;
    let active = true;
    listWarbandHiredSwords(warbandId)
      .then((data) => {
        if (active) {
          setHiredSwords(data);
          onHiredSwordsChange?.(data);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [warbandId, onHiredSwordsChange]);

  const {
    hiredSwordForms,
    removedHiredSwordIds,
    updateHiredSwordForm,
    removeHiredSwordForm,
    appendHiredSwordForm,
    expandedHiredSwordId,
    setExpandedHiredSwordId,
    initializeHiredSwordForms,
    resetHiredSwordForms,
    originalFormsRef,
  } = useHiredSwordForms({ hiredSwords, mapHiredSwordToForm });

  const formErrors = useMemo(
    () => hiredSwordForms.map((entry) => validateHiredSwordForm(entry)),
    [hiredSwordForms]
  );

  const {
    newHiredSwordForm,
    setNewHiredSwordForm,
    isAddingHiredSwordForm,
    setIsAddingHiredSwordForm,
    newHiredSwordError,
    setNewHiredSwordError,
    raceQuery,
    setRaceQuery,
    isRaceDialogOpen,
    setIsRaceDialogOpen,
    matchingRaces,
    isHiredSwordLimitReached,
    handleAddHiredSword,
    resetHiredSwordCreationForm,
  } = useHiredSwordCreationForm({
    hiredSwordFormsCount: hiredSwordForms.length,
    maxHiredSwords,
    availableRaces,
    appendHiredSwordForm,
  });

  const handleSaveSuccess = useCallback(
    (refreshed: WarbandHiredSword[]) => {
      setHiredSwords(refreshed);
      onHiredSwordsChange?.(refreshed);
      resetHiredSwordForms();
      resetHiredSwordCreationForm();
      setIsEditing(false);
      setExpandedHiredSwordId(null);
      setPendingEditFocus(null);
    },
    [onHiredSwordsChange, resetHiredSwordForms, resetHiredSwordCreationForm, setExpandedHiredSwordId]
  );

  const {
    isSaving,
    saveError,
    setSaveError,
    hasAttemptedSave,
    setHasAttemptedSave,
    handleSaveChanges,
  } = useWarbandHiredSwordsSave({
    warbandId,
    canEdit,
    hiredSwordForms,
    removedHiredSwordIds,
    isAddingHiredSwordForm,
    newHiredSwordForm,
    raceQuery,
    originalHiredSwordFormsRef: originalFormsRef,
    onSuccess: handleSaveSuccess,
    pendingPurchases,
    onPendingCleared: () => setPendingPurchases([]),
  });

  const pendingSpend = useMemo(() => getPendingSpend(pendingPurchases), [pendingPurchases]);

  const handlePendingPurchaseAdd = useCallback(
    (purchase: PendingPurchase) => {
      setPendingPurchases((prev) => [...prev, purchase]);
    },
    []
  );

  const handlePendingPurchaseRemove = useCallback(
    (match: { unitType: "heroes" | "henchmen" | "hiredswords" | "stash"; unitId: string; itemId: number }) => {
      setPendingPurchases((prev) => removePendingPurchase(prev, match));
    },
    []
  );

  const startEditing = async () => {
    if (!canEdit || !warbandId) return;
    setSaveError("");
    setHasAttemptedSave(false);
    setPendingPurchases([]);
    setIsLoadingDetails(true);
    try {
      const detailed = await listWarbandHiredSwordDetails(warbandId);
      setHiredSwords(detailed);
      initializeHiredSwordForms(detailed);
      resetHiredSwordCreationForm();
      setIsEditing(true);
    } catch (err) {
      if (err instanceof Error) {
        setSaveError(err.message || "Unable to load hired sword details.");
      } else {
        setSaveError("Unable to load hired sword details.");
      }
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    resetHiredSwordForms();
    resetHiredSwordCreationForm();
    setSaveError("");
    setHasAttemptedSave(false);
    setPendingEditFocus(null);
    setPendingPurchases([]);
  };

  const handleToggleHiredSword = useCallback(
    (hiredSwordId: number) => {
      if (expandedHiredSwordId === hiredSwordId) {
        setExpandedHiredSwordId(null);
        return;
      }
      setExpandedHiredSwordId(hiredSwordId);
    },
    [expandedHiredSwordId, setExpandedHiredSwordId]
  );

  const handleHiredSwordUpdated = useCallback(
    (updated: WarbandHiredSword) => {
      setHiredSwords((prev) =>
        prev.map((entry) => (entry.id === updated.id ? updated : entry))
      );
      onHiredSwordUpdated?.(updated);
    },
    [onHiredSwordUpdated]
  );

  const handleItemCreated = (index: number, item: Item) => {
    onItemCreated(index, item);
  };

  const handleSkillCreated = (index: number, skill: Skill) => {
    updateHiredSwordForm(index, (current) => ({
      ...current,
      skills: [...current.skills, skill],
    }));
  };

  const handleRemoveHiredSwordForm = useCallback(
    (index: number) => {
      const hiredSwordId = hiredSwordForms[index]?.id;
      if (hiredSwordId) {
        setPendingPurchases((prev) =>
          prev.filter((entry) => entry.unitId !== String(hiredSwordId))
        );
      }
      removeHiredSwordForm(index);
    },
    [hiredSwordForms, removeHiredSwordForm]
  );

  useEffect(() => {
    if (!expandedHiredSwordId || isMobileLayout) return;
    const node = sectionRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [expandedHiredSwordId]);

  const handlePendingEntryClick = useCallback(
    async (hiredSwordId: number, tab: "skills" | "spells" | "special") => {
      setPendingEditFocus({ hiredSwordId, tab });
      await startEditing();
    },
    []
  );

  const statusNode = isEditing ? (
    <>
      {isItemsLoading ? <p className="text-xs text-muted-foreground">Loading items...</p> : null}
      {itemsError ? <p className="text-xs text-red-500">{itemsError}</p> : null}
      {isSkillsLoading ? <p className="text-xs text-muted-foreground">Loading skills...</p> : null}
      {skillsError ? <p className="text-xs text-red-500">{skillsError}</p> : null}
      {isSpellsLoading ? <p className="text-xs text-muted-foreground">Loading spells...</p> : null}
      {spellsError ? <p className="text-xs text-red-500">{spellsError}</p> : null}
      {isSpecialsLoading ? <p className="text-xs text-muted-foreground">Loading specials...</p> : null}
      {specialsError ? <p className="text-xs text-red-500">{specialsError}</p> : null}
      {isRacesLoading ? <p className="text-xs text-muted-foreground">Loading races...</p> : null}
      {racesError ? <p className="text-xs text-red-500">{racesError}</p> : null}
    </>
  ) : null;

  const hiredSwordCount = isEditing ? hiredSwordForms.length : hiredSwords.length;
  const hiredSwordCountLabel = `[${hiredSwordCount}/${maxHiredSwords}]`;

  return (
    <div ref={sectionRef}>
      <WarbandSectionShell
        title="Hired Swords"
        titleSuffix={hiredSwordCountLabel}
        isEditing={isEditing}
        canEdit={canEdit}
        variant={sectionVariant}
        className={isMobileLayout ? "px-2" : undefined}
        headerClassName={isMobileLayout ? "gap-2" : undefined}
        editLabel="Edit Hired Swords"
        onEdit={startEditing}
        onCancel={cancelEditing}
        onSave={handleSaveChanges}
        isSaving={isSaving}
        isLoadingDetails={isLoadingDetails}
        status={statusNode}
        saveError={saveError}
        pendingSpend={pendingSpend}
        availableGold={availableGold}
      >
        {isEditing ? (
          <div className="space-y-5">
            {hiredSwordForms.map((entry, index) => (
              <HiredSwordFormCard
                key={entry.id ?? `new-${index}`}
                entry={entry}
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
                onUpdate={updateHiredSwordForm}
                onRemove={handleRemoveHiredSwordForm}
                onItemCreated={handleItemCreated}
                onSkillCreated={handleSkillCreated}
                onRaceCreated={onRaceCreated}
                deferItemCommit
                reservedGold={pendingSpend}
                onPendingPurchaseAdd={handlePendingPurchaseAdd}
                onPendingPurchaseRemove={handlePendingPurchaseRemove}
                error={hasAttemptedSave ? formErrors[index] ?? null : null}
                initialTab={pendingEditFocus && entry.id === pendingEditFocus.hiredSwordId ? pendingEditFocus.tab : undefined}
              />
            ))}
            {isAddingHiredSwordForm ? (
              <AddHiredSwordForm
                campaignId={campaignId}
                newHiredSwordForm={newHiredSwordForm}
                setNewHiredSwordForm={setNewHiredSwordForm}
                newHiredSwordError={newHiredSwordError}
                setNewHiredSwordError={setNewHiredSwordError}
                availableItems={availableItems}
                availableSkills={availableSkills}
                availableSpells={availableSpells}
                availableSpecials={availableSpecials}
                canAddCustom={canAddCustom}
                onItemCreated={onItemCreated}
                raceQuery={raceQuery}
                setRaceQuery={setRaceQuery}
                isRaceDialogOpen={isRaceDialogOpen}
                setIsRaceDialogOpen={setIsRaceDialogOpen}
                matchingRaces={matchingRaces}
                onAddHiredSword={handleAddHiredSword}
                isHiredSwordLimitReached={isHiredSwordLimitReached}
                maxHiredSwords={maxHiredSwords}
                onCancel={() => {
                  setIsAddingHiredSwordForm(false);
                  setNewHiredSwordError("");
                }}
                onRaceCreated={onRaceCreated}
              />
            ) : null}
            {isEditing && !isAddingHiredSwordForm ? (
              <div className="flex justify-start">
                <Button
                  type="button"
                  onClick={() => {
                    setIsAddingHiredSwordForm(true);
                    setNewHiredSwordError("");
                  }}
                  disabled={isHiredSwordLimitReached}
                >
                  Add hired sword
                </Button>
              </div>
            ) : null}
          </div>
        ) : hiredSwords.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hired swords yet.
          </p>
        ) : (
          <div className="space-y-4">
            {isMobileLayout ? (
              <div className="space-y-4">
                {hiredSwords.map((entry) => {
                  const isExpanded = expandedHiredSwordId === entry.id;
                  const levelUpNode = canEdit ? (
                    <HiredSwordLevelUpControl
                      hiredSword={entry}
                      warbandId={warbandId}
                      onLevelUpLogged={handleHiredSwordUpdated}
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
                    <div key={entry.id} className="space-y-3">
                      {isExpanded ? (
                        <HiredSwordExpandedCard
                          hiredSword={entry}
                          warbandId={warbandId}
                          onClose={() => setExpandedHiredSwordId(null)}
                          onHiredSwordUpdated={handleHiredSwordUpdated}
                          onPendingEntryClick={handlePendingEntryClick}
                          layoutVariant="mobile"
                          levelUpControl={levelUpNode}
                          levelThresholds={levelThresholds}
                        />
                      ) : (
                        <HiredSwordSummaryCard
                          hiredSword={entry}
                          warbandId={warbandId}
                          isExpanded={false}
                          renderExpandedCard={false}
                          expandButtonPlacement="bottom"
                          fullWidthItems
                          onHiredSwordUpdated={handleHiredSwordUpdated}
                          onPendingEntryClick={handlePendingEntryClick}
                          availableSpells={availableSpells}
                          levelUpControl={levelUpNode}
                          levelThresholds={levelThresholds}
                          onToggle={() => handleToggleHiredSword(entry.id)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {expandedHiredSwordId && hiredSwords.find((entry) => entry.id === expandedHiredSwordId) ? (() => {
                  const expanded = hiredSwords.find((entry) => entry.id === expandedHiredSwordId)!;
                  return (
                    <HiredSwordExpandedCard
                      hiredSword={expanded}
                      warbandId={warbandId}
                      onClose={() => setExpandedHiredSwordId(null)}
                      onHiredSwordUpdated={handleHiredSwordUpdated}
                      onPendingEntryClick={handlePendingEntryClick}
                      levelUpControl={canEdit ? (
                        <HiredSwordLevelUpControl
                          hiredSword={expanded}
                          warbandId={warbandId}
                          onLevelUpLogged={handleHiredSwordUpdated}
                          trigger={
                            <button
                              type="button"
                              className="level-up-banner level-up-banner--expanded absolute left-1/2 top-0 rounded-full border border-[#6e5a3b] bg-[#3b2a1a] px-4 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-[#f5d97b]"
                            >
                              Level Up!
                            </button>
                          }
                        />
                      ) : undefined}
                      levelThresholds={levelThresholds}
                    />
                  );
                })() : null}
                <div className="warband-hero-grid">
                  {hiredSwords
                    .filter((entry) => entry.id !== expandedHiredSwordId)
                    .map((entry) => (
                      <div key={entry.id} className="warband-hero-slot">
                        <HiredSwordSummaryCard
                          hiredSword={entry}
                          warbandId={warbandId}
                          isExpanded={false}
                          onHiredSwordUpdated={handleHiredSwordUpdated}
                          onPendingEntryClick={handlePendingEntryClick}
                          availableSpells={availableSpells}
                          levelUpControl={canEdit ? (
                            <HiredSwordLevelUpControl
                              hiredSword={entry}
                              warbandId={warbandId}
                              onLevelUpLogged={handleHiredSwordUpdated}
                              trigger={
                                <button
                                  type="button"
                                  className="level-up-banner absolute left-1/2 top-0 rounded-full border border-[#6e5a3b] bg-[#3b2a1a] px-4 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-[#f5d97b]"
                                >
                                  Level Up!
                                </button>
                              }
                            />
                          ) : undefined}
                          levelThresholds={levelThresholds}
                          onToggle={() => handleToggleHiredSword(entry.id)}
                        />
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}
      
      </WarbandSectionShell>
    </div>
  );
}
