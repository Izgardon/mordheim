import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@components/button";
import WarbandSectionShell from "../shared/sections/WarbandSectionShell";
import AddHiredSwordForm from "./forms/AddHiredSwordForm";
import HiredSwordFormCard from "./forms/HiredSwordFormCard";
import HiredSwordSummaryCard from "./cards/HiredSwordSummaryCard";
import HiredSwordLevelUpControl from "./controls/HiredSwordLevelUpControl";

import { useHiredSwordForms } from "../../hooks/hiredswords/useHiredSwordForms";
import { useHiredSwordCreationForm } from "../../hooks/hiredswords/useHiredSwordCreationForm";
import { useWarbandHiredSwordsSave } from "../../hooks/hiredswords/useWarbandHiredSwordsSave";
import { createWarbandHiredSword, listWarbandHiredSwordDetails } from "../../api/warbands-api";
import { emitWarbandUpdate } from "../../api/warbands-events";
import { buildStatPayload, mapHiredSwordToForm, parseAvailableSkills, toNullableNumber, validateHiredSwordForm } from "../../utils/warband-utils";
import { getHiredSwordProfile } from "../../../bestiary/api/bestiary-api";
import { buildPendingChanges, removePendingPurchase, type PendingPurchase } from "../../utils/pending-purchases";
import { getWarbandMobileEditItemId } from "../../hooks/warband/useWarbandMobileTopBar";

import type { Item } from "../../../items/types/item-types";
import type { Special } from "../../../special/types/special-types";
import type { Race } from "../../../races/types/race-types";
import type { Skill } from "../../../skills/types/skill-types";
import type { Spell } from "../../../spells/types/spell-types";
import type { HeroCaster, HiredSwordFormEntry, WarbandHiredSword } from "../../types/warband-types";

type SkillField = {
  key: string;
  label: string;
};

type WarbandHiredSwordsSectionProps = {
  warbandId: number;
  hiredSwords: WarbandHiredSword[];
  canEdit: boolean;
  actionsHidden?: boolean;
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
  onMobileEditChange?: (state: {
    isEditing: boolean;
    onSave?: () => void;
    onCancel?: () => void;
    isSaving?: boolean;
    navigationItems?: { value: string; label: string; elementId: string }[];
  }) => void;
  showLoadoutOnMobile?: boolean;
};

export default function WarbandHiredSwordsSection({
  warbandId,
  hiredSwords,
  canEdit,
  actionsHidden = false,
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
  onMobileEditChange,
  showLoadoutOnMobile = false,
}: WarbandHiredSwordsSectionProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [pendingEditFocus, setPendingEditFocus] = useState<{ hiredSwordId: number; tab: "skills" | "spells" | "special" } | null>(null);
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
  const isMobileLayout = layoutVariant === "mobile";
  const sectionVariant = isMobileLayout ? "plain" : "card";

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

  const appendHiredSwordFormAsync = useCallback(
    async (formEntry: HiredSwordFormEntry) => {
      const created = await createWarbandHiredSword(warbandId, {
        name: formEntry.name.trim() || null,
        unit_type: formEntry.unit_type.trim() || null,
        race: formEntry.race_id ?? null,
        price: toNullableNumber(formEntry.price) ?? 0,
        upkeep_price: toNullableNumber(formEntry.upkeep_price) ?? 0,
        rating: toNullableNumber(formEntry.rating) ?? 0,
        xp: toNullableNumber(formEntry.xp) ?? 0,
        deeds: null,
        armour_save: null,
        large: formEntry.large,
        caster: formEntry.caster,
        half_rate: formEntry.half_rate,
        blood_pacted: formEntry.blood_pacted,
        available_skills: formEntry.available_skills,
        ...buildStatPayload(formEntry),
        items: formEntry.items.map((item) => ({ id: item.id, cost: item.cost ?? null })),
        skill_ids: formEntry.skills.map((skill) => skill.id),
        special_ids: formEntry.specials?.map((s) => s.id) ?? [],
        spell_ids: formEntry.spells.map((spell) => spell.id),
      }, { emitUpdate: false });
      const hiredSwordFormEntry = { ...formEntry, id: created.id };
      appendHiredSwordForm(hiredSwordFormEntry);
      originalFormsRef.current?.set(created.id, JSON.stringify(hiredSwordFormEntry));
      onHiredSwordsChange?.([...hiredSwords, created]);
      setExpandedHiredSwordId(created.id);
      emitWarbandUpdate(warbandId, {
        hiredSwords: [created],
      });
    },
    [appendHiredSwordForm, hiredSwords, onHiredSwordsChange, originalFormsRef, setExpandedHiredSwordId, warbandId]
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
    appendHiredSwordForm: appendHiredSwordFormAsync,
  });

  const handleAddFromPreset = useCallback(
    async (profileId: number) => {
      const profile = await getHiredSwordProfile(profileId);
      const entry = profile.bestiary_entry;
      const matchedRace = profile.race
        ? (availableRaces.find((r) => r.name.toLowerCase() === profile.race.toLowerCase()) ?? null)
        : null;

      setNewHiredSwordForm({
        name: entry.name,
        unit_type: entry.name,
        race_id: matchedRace?.id ?? null,
        race_name: matchedRace?.name ?? "",
        stats: {
          M: String(entry.movement),
          WS: String(entry.weapon_skill),
          BS: String(entry.ballistic_skill),
          S: String(entry.strength),
          T: String(entry.toughness),
          W: String(entry.wounds),
          I: String(entry.initiative),
          A: String(entry.attacks),
          Ld: String(entry.leadership),
        },
        price: String(profile.hire_cost ?? 0),
        upkeep_price: String(profile.upkeep_cost ?? 0),
        rating: String(profile.rating ?? 0),
        xp: "0",
        armour_save: entry.armour_save != null ? String(entry.armour_save) : "",
        large: entry.large,
        caster: entry.caster as HeroCaster,
        half_rate: false,
        blood_pacted: false,
        available_skills: parseAvailableSkills(profile.available_skill_types),
        items: entry.equipment.map((eq) => eq.item as Item),
        skills: entry.skills as Skill[],
        spells: entry.spells as Spell[],
        specials: entry.specials as Special[],
      });
      setRaceQuery(matchedRace?.name ?? profile.race ?? "");
      setNewHiredSwordError("");
    },
    [availableRaces, setNewHiredSwordError, setNewHiredSwordForm, setRaceQuery]
  );

  const handleSaveSuccess = useCallback(
    (refreshed: WarbandHiredSword[]) => {
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
    currentHiredSwords: hiredSwords,
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

  const pendingChanges = useMemo(() => buildPendingChanges(pendingPurchases), [pendingPurchases]);
  const pendingSpend = useMemo(() => pendingChanges.reduce((s, c) => s + c.amount, 0), [pendingChanges]);

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
      onHiredSwordsChange?.(detailed);
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
      const next = hiredSwords.map((entry) => (entry.id === updated.id ? updated : entry));
      onHiredSwordsChange?.(next);
      emitWarbandUpdate(warbandId, { hiredSwords: [updated] });
      onHiredSwordUpdated?.(updated);
    },
    [hiredSwords, onHiredSwordUpdated, onHiredSwordsChange, warbandId]
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
  const mobileEditNavigationItems = useMemo(
    () => {
      const items = hiredSwordForms.map((entry, index) => {
        const value = entry.id ? `hired-sword-${entry.id}` : `draft-${index}`;
        return {
          value,
          label: entry.name.trim() || "New Hired Sword",
          elementId: getWarbandMobileEditItemId("hiredswords", value),
        };
      });
      if (!isAddingHiredSwordForm) {
        items.push({
          value: "add-new",
          label: "Add new",
          elementId: getWarbandMobileEditItemId("hiredswords", "add-new"),
        });
      }
      return items;
    },
    [hiredSwordForms, isAddingHiredSwordForm]
  );

  useEffect(() => {
    onMobileEditChange?.({
      isEditing,
      onSave: handleSaveChanges,
      onCancel: cancelEditing,
      isSaving,
      navigationItems: mobileEditNavigationItems,
    });
  }, [cancelEditing, handleSaveChanges, isEditing, isSaving, mobileEditNavigationItems, onMobileEditChange]);

  useEffect(() => {
    if (!expandedHiredSwordId || isMobileLayout) return;
    const node = sectionRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [expandedHiredSwordId]);

  // Keep the slot wide for the duration of the exit animation (200ms) so the
  // expanded card doesn't snap into a narrow column before fading out.
  const [visuallyExpandedSlotId, setVisuallyExpandedSlotId] = useState(expandedHiredSwordId);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (expandedHiredSwordId !== null) {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      setVisuallyExpandedSlotId(expandedHiredSwordId);
    } else {
      collapseTimerRef.current = setTimeout(() => setVisuallyExpandedSlotId(null), 200);
    }
    return () => { if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current); };
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
        className={isMobileLayout ? "px-0" : undefined}
        headerClassName={isMobileLayout ? "gap-2" : undefined}
        actionsHidden={actionsHidden}
        editLabel="Edit Hired Swords"
        onEdit={startEditing}
        onCancel={cancelEditing}
        onSave={handleSaveChanges}
        isSaving={isSaving}
        isLoadingDetails={isLoadingDetails}
        status={statusNode}
        saveError={saveError}
        pendingSpend={pendingSpend}
        pendingChanges={pendingChanges}
        availableGold={availableGold}
      >
        {isEditing ? (
          <div className="space-y-5">
            {hiredSwordForms.map((entry, index) => (
              <div
                key={entry.id ?? `new-${index}`}
                id={getWarbandMobileEditItemId(
                  "hiredswords",
                  entry.id ? `hired-sword-${entry.id}` : `draft-${index}`
                )}
                className="scroll-mt-28"
              >
                <HiredSwordFormCard
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
              </div>
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
                onAddFromPreset={async (profileId) => {
                  await handleAddFromPreset(profileId);
                }}
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
              <div
                id={getWarbandMobileEditItemId("hiredswords", "add-new")}
                className="scroll-mt-28"
              >
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
              <div className="space-y-10">
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
                    <div key={entry.id} className="space-y-5">
                      <HiredSwordSummaryCard
                        hiredSword={entry}
                        warbandId={warbandId}
                        isExpanded={isExpanded}
                        expandButtonPlacement="bottom"
                        fullWidthItems
                        onHiredSwordUpdated={handleHiredSwordUpdated}
                        onPendingEntryClick={handlePendingEntryClick}
                        availableSpells={availableSpells}
                        levelUpControl={levelUpNode}
                        levelThresholds={levelThresholds}
                        layoutVariant="mobile"
                        showLoadoutOnMobile={showLoadoutOnMobile}
                        canEdit={canEdit}
                        onToggle={() => handleToggleHiredSword(entry.id)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="warband-hero-grid">
                {hiredSwords.map((entry) => {
                  const isExpanded = expandedHiredSwordId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className={`warband-hero-slot${visuallyExpandedSlotId === entry.id ? " warband-hero-slot--expanded" : ""}`}
                    >
                      <HiredSwordSummaryCard
                        hiredSword={entry}
                        warbandId={warbandId}
                        isExpanded={isExpanded}
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
                        onToggle={() => handleToggleHiredSword(entry.id)}
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
