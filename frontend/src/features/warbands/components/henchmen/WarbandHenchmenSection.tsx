import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import AddHenchmenGroupForm from "./forms/AddHenchmenGroupForm";
import HenchmenFormCard from "./forms/HenchmenFormCard";
import HenchmenSummaryCard from "./cards/HenchmenSummaryCard";
import HenchmenExpandedCard from "./cards/HenchmenExpandedCard";
import HenchmenLevelUpControl from "./controls/HenchmenLevelUpControl";

import { useHenchmenGroupForms } from "../../hooks/henchmen/useHenchmenGroupForms";
import { useHenchmenGroupCreationForm } from "../../hooks/henchmen/useHenchmenGroupCreationForm";
import { useWarbandHenchmenSave } from "../../hooks/henchmen/useWarbandHenchmenSave";
import { listWarbandHenchmenGroups } from "../../api/warbands-api";
import { mapHenchmenGroupToForm, validateHenchmenGroupForm } from "../../utils/warband-utils";

import type { Item } from "../../../items/types/item-types";
import type { Special } from "../../../special/types/special-types";
import type { Race } from "../../../races/types/race-types";
import type { Skill } from "../../../skills/types/skill-types";
import type { HenchmenGroup } from "../../types/warband-types";

type WarbandHenchmenSectionProps = {
  warbandId: number;
  canEdit: boolean;
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpecials: Special[];
  availableRaces: Race[];
  canAddCustom?: boolean;
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
};

export default function WarbandHenchmenSection({
  warbandId,
  canEdit,
  availableItems,
  availableSkills,
  availableSpecials,
  availableRaces,
  canAddCustom = false,
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
}: WarbandHenchmenSectionProps) {
  const [groups, setGroups] = useState<HenchmenGroup[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

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
    appendGroupForm,
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
  });

  const startEditing = async () => {
    if (!canEdit || !warbandId) return;
    setSaveError("");
    setHasAttemptedSave(false);
    setIsLoadingDetails(true);
    try {
      const detailed = await listWarbandHenchmenGroups(warbandId);
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

  const handleItemCreated = (index: number, item: Item) => {
    updateGroupForm(index, (current) => ({
      ...current,
      items: [...current.items, item],
    }));
  };

  const handleSkillCreated = (index: number, skill: Skill) => {
    updateGroupForm(index, (current) => ({
      ...current,
      skills: [...current.skills, skill],
    }));
  };

  useEffect(() => {
    if (!expandedGroupId) return;
    const node = sectionRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [expandedGroupId]);

  return (
    <div ref={sectionRef}>
      <CardBackground
        className={`warband-section-hover ${isEditing ? "warband-section-editing" : ""} space-y-4 p-7`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl font-bold" style={{ color: '#a78f79' }}>Henchmen</h2>
          <div className="section-edit-actions ml-auto flex items-center gap-2">
            {!isEditing && canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startEditing}
                disabled={isLoadingDetails}
              >
                {isLoadingDetails ? "Loading..." : "Edit Henchmen"}
              </Button>
            ) : null}
            {isEditing && canEdit ? (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={cancelEditing}>Cancel</Button>
                <Button type="button" size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {isEditing ? (
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
        ) : null}

        {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}

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
                onRemove={removeGroupForm}
                onItemCreated={handleItemCreated}
                onSkillCreated={handleSkillCreated}
                onRaceCreated={onRaceCreated}
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
            {expandedGroupId && groups.find((g) => g.id === expandedGroupId) ? (() => {
              const expandedGroup = groups.find((g) => g.id === expandedGroupId)!;
              return (
                <HenchmenExpandedCard
                  group={expandedGroup}
                  warbandId={warbandId}
                  onClose={() => setExpandedGroupId(null)}
                  onGroupUpdated={handleGroupUpdated}
                  levelUpControl={canEdit ? (
                    <HenchmenLevelUpControl
                      group={expandedGroup}
                      warbandId={warbandId}
                      onLevelUpLogged={handleGroupUpdated}
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
                />
              );
            })() : null}
            <div className="warband-hero-grid">
              {groups
                .filter((g) => g.id !== expandedGroupId)
                .map((group) => (
                  <div key={group.id} className="warband-hero-slot">
                    <HenchmenSummaryCard
                      group={group}
                      warbandId={warbandId}
                      isExpanded={false}
                      onGroupUpdated={handleGroupUpdated}
                      levelUpControl={canEdit ? (
                        <HenchmenLevelUpControl
                          group={group}
                          warbandId={warbandId}
                          onLevelUpLogged={handleGroupUpdated}
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
                      onToggle={() => handleToggleGroup(group.id)}
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
