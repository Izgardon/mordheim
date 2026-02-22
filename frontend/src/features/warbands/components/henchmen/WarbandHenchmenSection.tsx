import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@components/button";
import WarbandSectionShell from "../shared/sections/WarbandSectionShell";
import AddHenchmenGroupForm from "./forms/AddHenchmenGroupForm";
import HenchmenFormCard from "./forms/HenchmenFormCard";
import HenchmenSummaryCard from "./cards/HenchmenSummaryCard";
import HenchmenLevelUpControl from "./controls/HenchmenLevelUpControl";

import { useHenchmenGroupForms } from "../../hooks/henchmen/useHenchmenGroupForms";
import { useHenchmenGroupCreationForm } from "../../hooks/henchmen/useHenchmenGroupCreationForm";
import { useWarbandHenchmenSave } from "../../hooks/henchmen/useWarbandHenchmenSave";
import { createWarbandHenchmenGroup, createWarbandLog, createWarbandTrade, listWarbandHenchmenGroupDetails, listWarbandHenchmenGroups } from "../../api/warbands-api";
import { emitWarbandUpdate } from "../../api/warbands-events";
import { buildHenchmenGroupStatPayload, mapHenchmenGroupToForm, toNullableNumber, validateHenchmenGroupForm } from "../../utils/warband-utils";
import { getPendingSpend, removePendingPurchase, type PendingPurchase } from "../../utils/pending-purchases";

import type { Item } from "../../../items/types/item-types";
import type { Special } from "../../../special/types/special-types";
import type { Race } from "../../../races/types/race-types";
import type { Skill } from "../../../skills/types/skill-types";
import type { HenchmenGroup, HenchmenGroupFormEntry } from "../../types/warband-types";

type WarbandHenchmenSectionProps = {
  warbandId: number;
  canEdit: boolean;
  actionsHidden?: boolean;
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpecials: Special[];
  availableRaces: Race[];
  canAddCustom?: boolean;
  onItemCreated: (index: number, item: Item) => void;
  itemsError: string;
  skillsError: string;
  specialsError: string;
  racesError: string;
  isItemsLoading: boolean;
  isSkillsLoading: boolean;
  isSpecialsLoading: boolean;
  isRacesLoading: boolean;
  campaignId: number;
  statFields: readonly string[];
  onRaceCreated: (race: Race) => void;
  availableGold: number;
  levelThresholds?: readonly number[];
  layoutVariant?: "default" | "mobile";
  onMobileEditChange?: (state: {
    isEditing: boolean;
    onSave?: () => void;
    onCancel?: () => void;
    isSaving?: boolean;
  }) => void;
};

export default function WarbandHenchmenSection({
  warbandId,
  canEdit,
  actionsHidden = false,
  availableItems,
  availableSkills,
  availableSpecials,
  availableRaces,
  canAddCustom = false,
  onItemCreated,
  itemsError,
  skillsError,
  specialsError,
  racesError,
  isItemsLoading,
  isSkillsLoading,
  isSpecialsLoading,
  isRacesLoading,
  campaignId,
  statFields,
  onRaceCreated,
  availableGold,
  levelThresholds,
  layoutVariant = "default",
  onMobileEditChange,
}: WarbandHenchmenSectionProps) {
  const [groups, setGroups] = useState<HenchmenGroup[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
  const isMobileLayout = layoutVariant === "mobile";
  const sectionVariant = isMobileLayout ? "plain" : "card";

  // Load groups on mount
  useEffect(() => {
    if (!warbandId) return;
    let active = true;
    listWarbandHenchmenGroups(warbandId)
      .then((data) => { if (active) setGroups(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [warbandId]);

  const {
    groupForms,
    removedGroupIds,
    updateGroupForm,
    removeGroupForm,
    appendGroupForm,
    expandedGroupId,
    setExpandedGroupId,
    initializeGroupForms,
    resetGroupForms,
    originalGroupFormsRef,
  } = useHenchmenGroupForms({ groups, mapGroupToForm: mapHenchmenGroupToForm });

  const groupErrors = useMemo(
    () => groupForms.map((group) => validateHenchmenGroupForm(group)),
    [groupForms]
  );

  const appendGroupFormAsync = useCallback(
    async (formEntry: HenchmenGroupFormEntry) => {
      const created = await createWarbandHenchmenGroup(warbandId, {
        name: formEntry.name.trim() || null,
        unit_type: formEntry.unit_type.trim() || null,
        race: formEntry.race_id ?? null,
        price: toNullableNumber(formEntry.price) ?? 0,
        xp: toNullableNumber(formEntry.xp) ?? 0,
        max_size: toNullableNumber(formEntry.max_size) ?? 5,
        deeds: null,
        armour_save: null,
        large: formEntry.large,
        half_rate: formEntry.half_rate,
        ...buildHenchmenGroupStatPayload(formEntry),
        item_ids: [],
        skill_ids: [],
        special_ids: [],
        henchmen: formEntry.henchmen.map((h) => ({
          ...(h.id ? { id: h.id } : {}),
          name: h.name,
          kills: h.kills,
          dead: h.dead,
        })),
      }, { emitUpdate: false });
      const groupFormEntry = {
        ...formEntry,
        id: created.id,
        henchmen: created.henchmen.map((h) => ({
          id: h.id,
          name: h.name,
          kills: h.kills,
          dead: h.dead,
        })),
      };
      appendGroupForm(groupFormEntry);
      originalGroupFormsRef.current?.set(created.id, JSON.stringify(groupFormEntry));
      setGroups((prev) => [...prev, created]);
      setExpandedGroupId(created.id);
      const recruitPrice = toNullableNumber(formEntry.price) ?? 0;
      if (recruitPrice > 0) {
        const groupName = created.name?.trim() || formEntry.name;
        await createWarbandTrade(warbandId, {
          action: "Recruit",
          description: groupName,
          price: recruitPrice,
        }, { emitUpdate: false });
        await createWarbandLog(warbandId, {
          feature: "roster",
          entry_type: "henchmen_recruit",
          payload: { hero: groupName, price: recruitPrice },
        }, { emitUpdate: false });
      }
      emitWarbandUpdate(warbandId);
    },
    [warbandId, appendGroupForm, originalGroupFormsRef, setExpandedGroupId]
  );

  const {
    newGroupForm,
    setNewGroupForm,
    isAddingGroupForm,
    setIsAddingGroupForm,
    newGroupError,
    setNewGroupError,
    raceQuery,
    setRaceQuery,
    isRaceDialogOpen,
    setIsRaceDialogOpen,
    matchingRaces,
    handleAddGroup,
    resetGroupCreationForm,
  } = useHenchmenGroupCreationForm({
    groupFormsCount: groupForms.length,
    availableRaces,
    appendGroupForm: appendGroupFormAsync,
  });

  const handleSaveSuccess = useCallback(
    (refreshedGroups: HenchmenGroup[]) => {
      setGroups(refreshedGroups);
      resetGroupForms();
      resetGroupCreationForm();
      setIsEditing(false);
      setExpandedGroupId(null);
    },
    [resetGroupForms, resetGroupCreationForm, setExpandedGroupId]
  );

  const {
    isSaving,
    saveError,
    setSaveError,
    hasAttemptedSave,
    setHasAttemptedSave,
    handleSaveChanges,
  } = useWarbandHenchmenSave({
    warbandId,
    canEdit,
    groupForms,
    removedGroupIds,
    isAddingGroupForm,
    newGroupForm,
    raceQuery,
    originalGroupFormsRef,
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
      const detailed = await listWarbandHenchmenGroupDetails(warbandId);
      setGroups(detailed);
      initializeGroupForms(detailed);
      resetGroupCreationForm();
      setIsEditing(true);
    } catch (err) {
      if (err instanceof Error) {
        setSaveError(err.message || "Unable to load group details.");
      } else {
        setSaveError("Unable to load group details.");
      }
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    resetGroupForms();
    resetGroupCreationForm();
    setSaveError("");
    setHasAttemptedSave(false);
    setPendingPurchases([]);
  };

  const handleToggleGroup = useCallback(
    (groupId: number) => {
      if (expandedGroupId === groupId) {
        setExpandedGroupId(null);
        return;
      }
      setExpandedGroupId(groupId);
    },
    [expandedGroupId, setExpandedGroupId]
  );

  const handleGroupUpdated = useCallback(
    (updatedGroup: HenchmenGroup) => {
      setGroups((prev) =>
        prev.map((g) => (g.id === updatedGroup.id ? updatedGroup : g))
      );
    },
    []
  );

  const handleGroupRemoved = useCallback(
    (groupId: number) => {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setExpandedGroupId((current) => (current === groupId ? null : current));
    },
    [setExpandedGroupId]
  );

  // Keep the slot wide for the duration of the exit animation (200ms) so the
  // expanded card doesn't snap into a narrow column before fading out.
  const [visuallyExpandedSlotId, setVisuallyExpandedSlotId] = useState(expandedGroupId);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (expandedGroupId !== null) {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      setVisuallyExpandedSlotId(expandedGroupId);
    } else {
      collapseTimerRef.current = setTimeout(() => setVisuallyExpandedSlotId(null), 200);
    }
    return () => { if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current); };
  }, [expandedGroupId]);

  const handleItemCreated = (index: number, item: Item) => {
    onItemCreated(index, item);
  };

  const handleSkillCreated = (index: number, skill: Skill) => {
    updateGroupForm(index, (current) => ({
      ...current,
      skills: [...current.skills, skill],
    }));
  };

  const handleRemoveGroupForm = useCallback(
    (index: number) => {
      const groupId = groupForms[index]?.id;
      if (groupId) {
        setPendingPurchases((prev) =>
          prev.filter((entry) => entry.unitId !== String(groupId))
        );
      }
      removeGroupForm(index);
    },
    [groupForms, removeGroupForm]
  );

  useEffect(() => {
    onMobileEditChange?.({
      isEditing,
      onSave: handleSaveChanges,
      onCancel: cancelEditing,
      isSaving,
    });
  }, [cancelEditing, handleSaveChanges, isEditing, isSaving, onMobileEditChange]);

  const statusNode = isEditing ? (
    <>
      {isItemsLoading ? <p className="text-xs text-muted-foreground">Loading items...</p> : null}
      {itemsError ? <p className="text-xs text-red-500">{itemsError}</p> : null}
      {isSkillsLoading ? <p className="text-xs text-muted-foreground">Loading skills...</p> : null}
      {skillsError ? <p className="text-xs text-red-500">{skillsError}</p> : null}
      {isSpecialsLoading ? <p className="text-xs text-muted-foreground">Loading specials...</p> : null}
      {specialsError ? <p className="text-xs text-red-500">{specialsError}</p> : null}
      {isRacesLoading ? <p className="text-xs text-muted-foreground">Loading races...</p> : null}
      {racesError ? <p className="text-xs text-red-500">{racesError}</p> : null}
    </>
  ) : null;

  const henchmenCount = useMemo(() => {
    const source = isEditing ? groupForms : groups;
    return source.reduce((total, group) => total + (group.henchmen?.length ?? 0), 0);
  }, [groupForms, groups, isEditing]);
  const henchmenCountLabel = `[${henchmenCount}]`;

  return (
    <div>
      <WarbandSectionShell
        title="Henchmen"
        titleSuffix={henchmenCountLabel}
        isEditing={isEditing}
        canEdit={canEdit}
        variant={sectionVariant}
        className={isMobileLayout ? "px-0" : undefined}
        headerClassName={isMobileLayout ? "gap-2" : undefined}
        actionsHidden={actionsHidden}
        editLabel="Edit Henchmen"
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
            {groupForms.map((group, index) => (
              <HenchmenFormCard
                key={group.id ?? `new-${index}`}
                group={group}
                index={index}
                campaignId={campaignId}
                statFields={statFields}
                availableRaces={availableRaces}
                availableItems={availableItems}
                availableSkills={availableSkills}
                availableSpecials={availableSpecials}
                canAddCustom={canAddCustom}
                onUpdate={updateGroupForm}
                onRemove={handleRemoveGroupForm}
                onItemCreated={handleItemCreated}
                onSkillCreated={handleSkillCreated}
                onRaceCreated={onRaceCreated}
                deferItemCommit
                reservedGold={pendingSpend}
                onPendingPurchaseAdd={handlePendingPurchaseAdd}
                onPendingPurchaseRemove={handlePendingPurchaseRemove}
                error={hasAttemptedSave ? groupErrors[index] ?? null : null}
              />
            ))}
            {isAddingGroupForm ? (
              <AddHenchmenGroupForm
                campaignId={campaignId}
                newGroupForm={newGroupForm}
                setNewGroupForm={setNewGroupForm}
                newGroupError={newGroupError}
                setNewGroupError={setNewGroupError}
                raceQuery={raceQuery}
                setRaceQuery={setRaceQuery}
                isRaceDialogOpen={isRaceDialogOpen}
                setIsRaceDialogOpen={setIsRaceDialogOpen}
                matchingRaces={matchingRaces}
                onAddGroup={handleAddGroup}
                onCancel={() => {
                  setIsAddingGroupForm(false);
                  setNewGroupError("");
                }}
                onRaceCreated={onRaceCreated}
              />
            ) : null}
            {isEditing && !isAddingGroupForm ? (
              <div className="flex justify-start">
                <Button
                  type="button"
                  onClick={() => {
                    setIsAddingGroupForm(true);
                    setNewGroupError("");
                  }}
                >
                  Add group
                </Button>
              </div>
            ) : null}
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No henchmen groups yet.
          </p>
        ) : (
          <div className="space-y-4">
            {isMobileLayout ? (
              <div className="space-y-6">
                {groups.map((group) => {
                  const isExpanded = expandedGroupId === group.id;
                  const levelUpNode = canEdit ? (
                    <HenchmenLevelUpControl
                      group={group}
                      warbandId={warbandId}
                      onLevelUpLogged={handleGroupUpdated}
                      onGroupRemoved={handleGroupRemoved}
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
                    <div key={group.id} className="space-y-3">
                      <HenchmenSummaryCard
                        group={group}
                        warbandId={warbandId}
                        isExpanded={isExpanded}
                        expandButtonPlacement="bottom"
                        fullWidthItems
                        onGroupUpdated={handleGroupUpdated}
                        levelUpControl={levelUpNode}
                        levelThresholds={levelThresholds}
                        layoutVariant="mobile"
                        canEdit={canEdit}
                        onToggle={() => handleToggleGroup(group.id)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="warband-hero-grid">
                {groups.map((group) => {
                  const isExpanded = expandedGroupId === group.id;
                  return (
                    <div
                      key={group.id}
                      className={`warband-hero-slot${visuallyExpandedSlotId === group.id ? " warband-hero-slot--expanded" : ""}`}
                    >
                      <HenchmenSummaryCard
                        group={group}
                        warbandId={warbandId}
                        isExpanded={isExpanded}
                        onGroupUpdated={handleGroupUpdated}
                        levelUpControl={canEdit ? (
                          <HenchmenLevelUpControl
                            group={group}
                            warbandId={warbandId}
                            onLevelUpLogged={handleGroupUpdated}
                            onGroupRemoved={handleGroupRemoved}
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
                        onToggle={() => handleToggleGroup(group.id)}
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
