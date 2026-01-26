import { useEffect, useMemo, useState, type ComponentProps } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

import "../styles/warband.css";

// components
import { Card } from "@components/card";
import TabbedCard from "@components/tabbed-card";
import CreateWarbandDialog from "../components/CreateWarbandDialog";
import BackstoryTab from "../components/history/BackstoryTab";
import LogsTab from "../components/logs/LogsTab";
import WarbandEditForm from "../components/WarbandEditForm";
import WarbandHeader from "../components/WarbandHeader";
import WarbandHeroesSection from "../components/heroes/WarbandHeroesSection";
import WarbandSummaryBar from "../components/WarbandSummaryBar";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";
import { useCampaignItems } from "../hooks/useCampaignItems";
import { useCampaignMemberPermissions } from "../hooks/useCampaignMemberPermissions";
import { useCampaignRaces } from "../hooks/useCampaignRaces";
import { useCampaignSkills } from "../hooks/useCampaignSkills";
import { useHeroCreationForm } from "../hooks/useHeroCreationForm";
import { useHeroForms } from "../hooks/useHeroForms";
import { useWarbandLoader } from "../hooks/useWarbandLoader";

// api
import {
  createWarband,
  createWarbandHero,
  deleteWarbandHero,
  listWarbandHeroes,
  updateWarband,
  updateWarbandHero,
} from "../api/warbands-api";

// utils
import {
  mapHeroToForm,
  skillFields,
  statFieldMap,
  statFields,
  toNullableNumber,
  toNumber,
} from "../utils/warband-utils";

// types
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";
import type { Item } from "../../items/types/item-types";
import type { Skill } from "../../skills/types/skill-types";
import type {
  HeroFormEntry,
  WarbandCreatePayload,
  WarbandResource,
  WarbandUpdatePayload,
} from "../types/warband-types";

type WarbandTab = "warband" | "backstory" | "logs";

export default function CampaignWarband() {
  const { id, warbandId } = useParams();
  const { user } = useAuth();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [activeTab, setActiveTab] = useState<WarbandTab>("warband");
  const [warbandForm, setWarbandForm] = useState<WarbandUpdatePayload>({
    name: "",
    faction: "",
  });

  const campaignId = useMemo(() => Number(id), [id]);
  const resolvedWarbandId = useMemo(() => (warbandId ? Number(warbandId) : null), [warbandId]);
  const hasCampaignId = Boolean(id);
  const isViewingOther = resolvedWarbandId !== null;

  const { warband, setWarband, heroes, setHeroes, isLoading, error } = useWarbandLoader({
    campaignId,
    hasCampaignId,
    resolvedWarbandId,
  });

  const {
    availableItems,
    setAvailableItems,
    itemsError,
    isItemsLoading,
  } = useCampaignItems({ campaignId, hasCampaignId });

  const {
    availableSkills,
    setAvailableSkills,
    skillsError,
    isSkillsLoading,
  } = useCampaignSkills({ campaignId, hasCampaignId });

  const { availableRaces, racesError, isRacesLoading, handleRaceCreated } = useCampaignRaces({
    campaignId,
    hasCampaignId,
  });

  const { memberPermissions } = useCampaignMemberPermissions({ campaignId, campaign });

  const {
    heroForms,
    removedHeroIds,
    updateHeroForm,
    removeHeroForm,
    appendHeroForm,
    expandedHeroId,
    setExpandedHeroId,
    initializeHeroForms,
    resetHeroForms,
  } = useHeroForms({ heroes, mapHeroToForm });

  const {
    newHeroForm,
    setNewHeroForm,
    isAddingHeroForm,
    setIsAddingHeroForm,
    newHeroError,
    setNewHeroError,
    raceQuery,
    setRaceQuery,
    isRaceDialogOpen,
    setIsRaceDialogOpen,
    matchingRaces,
    isHeroLimitReached,
    handleAddHero,
    resetHeroCreationForm,
  } = useHeroCreationForm({
    heroFormsCount: heroForms.length,
    availableRaces,
    appendHeroForm,
  });

  useEffect(() => {
    if (warband && !isEditing) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
  }, [warband, isEditing]);

  const isWarbandOwner = Boolean(warband && user && warband.user_id === user.id);
  const canEdit =
    Boolean(warband) &&
    (isWarbandOwner ||
      campaign?.role === "owner" ||
      campaign?.role === "admin" ||
      memberPermissions.includes("manage_warbands"));

  const warbandResources = warband?.resources ?? [];
  const { goldCrowns, otherResources } = useMemo(() => {
    const goldIndex = warbandResources.findIndex(
      (resource) => resource.name.trim().toLowerCase() === "gold crowns"
    );
    const goldResource = goldIndex >= 0 ? warbandResources[goldIndex] : null;
    const filtered = goldResource
      ? warbandResources.filter((_, index) => index !== goldIndex)
      : warbandResources;
    return {
      goldCrowns: goldResource?.amount ?? 0,
      otherResources: filtered,
    };
  }, [warbandResources]);

  const warbandRating = useMemo(() => {
    if (typeof warband?.rating === "number") {
      return warband.rating;
    }
    return heroes.reduce((total, hero) => {
      const base = hero.large ? 20 : 5;
      const xp = toNumber(hero.xp);
      return total + base + xp;
    }, 0);
  }, [heroes, warband?.rating]);

  const handleCreate = async (payload: WarbandCreatePayload) => {
    if (!id) {
      return;
    }

    if (Number.isNaN(campaignId) || isViewingOther) {
      return;
    }

    const created = await createWarband(campaignId, payload);
    setWarband(created);
    setHeroes([]);
    setIsEditing(false);
    setSaveMessage("");
    setSaveError("");
    resetHeroForms();
    resetHeroCreationForm();
    setWarbandForm({ name: created.name, faction: created.faction });
  };

  const startEditing = () => {
    if (!canEdit || !warband) {
      return;
    }

    setSaveMessage("");
    setSaveError("");
    setWarbandForm({ name: warband.name, faction: warband.faction });

    initializeHeroForms();
    resetHeroCreationForm();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    resetHeroForms();
    resetHeroCreationForm();
    setSaveMessage("");
    setSaveError("");
    if (warband) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
  };

  const handleItemCreated = (index: number, item: Item) => {
    setAvailableItems((prev) =>
      prev.some((existing) => existing.id === item.id) ? prev : [item, ...prev]
    );
    updateHeroForm(index, (current) => {
      if (current.items.some((existing) => existing.id === item.id)) {
        return current;
      }
      if (current.items.length >= 6) {
        return current;
      }
      return { ...current, items: [...current.items, item] };
    });
  };

  const handleSkillCreated = (index: number, skill: Skill) => {
    setAvailableSkills((prev) =>
      prev.some((existing) => existing.id === skill.id) ? prev : [skill, ...prev]
    );
    updateHeroForm(index, (current) => {
      if (current.skills.some((existing) => existing.id === skill.id)) {
        return current;
      }
      return { ...current, skills: [...current.skills, skill] };
    });
  };

  const handleSaveChanges = async () => {
    if (!warband || !canEdit) {
      return;
    }

    const trimmedName = warbandForm.name.trim();
    const trimmedFaction = warbandForm.faction.trim();
    if (!trimmedName || !trimmedFaction) {
      setSaveError("Name and faction are required.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const updatedWarband = await updateWarband(warband.id, {
        name: trimmedName,
        faction: trimmedFaction,
      });
      setWarband(updatedWarband);

      const buildStatPayload = (hero: HeroFormEntry) =>
        statFields.reduce((acc, key) => {
          const value = hero.stats[key];
          if (String(value).trim()) {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
              return { ...acc, [statFieldMap[key]]: parsed };
            }
          }
          return acc;
        }, {} as Record<string, number>);

      const createPromises = heroForms
        .filter((hero) => !hero.id)
        .map((hero) =>
          createWarbandHero(warband.id, {
            name: hero.name.trim() || null,
            unit_type: hero.unit_type.trim() || null,
            race: hero.race_id ?? null,
            price: toNullableNumber(hero.price) ?? 0,
            xp: toNullableNumber(hero.xp) ?? 0,
            armour_save: hero.armour_save.trim() || null,
            ...buildStatPayload(hero),
            item_ids: hero.items.map((item) => item.id),
            skill_ids: hero.skills.map((skill) => skill.id),
          })
        );

      const updatePromises = heroForms
        .filter((hero) => hero.id)
        .map((hero) =>
          updateWarbandHero(warband.id, hero.id as number, {
            name: hero.name.trim() || null,
            unit_type: hero.unit_type.trim() || null,
            race: hero.race_id ?? null,
            price: toNullableNumber(hero.price) ?? 0,
            xp: toNullableNumber(hero.xp) ?? 0,
            armour_save: hero.armour_save.trim() || null,
            ...buildStatPayload(hero),
            item_ids: hero.items.map((item) => item.id),
            skill_ids: hero.skills.map((skill) => skill.id),
          })
        );

      const deletePromises = removedHeroIds.map((heroId) =>
        deleteWarbandHero(warband.id, heroId)
      );

      await Promise.all([...createPromises, ...updatePromises, ...deletePromises]);

      const refreshed = await listWarbandHeroes(warband.id);
      setHeroes(refreshed);
      resetHeroForms();
      resetHeroCreationForm();
      setIsEditing(false);
      setSaveMessage("Warband updated.");
      setExpandedHeroId(null);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSaveError(errorResponse.message || "Unable to update warband");
      } else {
        setSaveError("Unable to update warband");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <WarbandHeader warband={warband} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Scanning the roster...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !warband ? (
        <Card className="p-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isViewingOther
                ? "No warband found for this record."
                : "No warband logged for this campaign yet."}
            </p>
            {!isViewingOther ? <CreateWarbandDialog onCreate={handleCreate} /> : null}
          </div>
        </Card>
      ) : (
        <TabbedCard
          tabs={[
            { id: "warband" as WarbandTab, label: "Warband" },
            { id: "backstory" as WarbandTab, label: "Backstory" },
            { id: "logs" as WarbandTab, label: "Logs" },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          {activeTab === "warband" ? (
            <WarbandTabContent
              warbandForm={warbandForm}
              onChangeWarbandForm={setWarbandForm}
              goldCrowns={goldCrowns}
              rating={warbandRating}
              otherResources={otherResources}
              saveMessage={saveMessage}
              saveError={saveError}
              canEdit={canEdit}
              isEditing={isEditing}
              isSaving={isSaving}
              onEdit={startEditing}
              onSave={handleSaveChanges}
              onCancel={cancelEditing}
              isHeroLimitReached={isHeroLimitReached}
              isAddingHeroForm={isAddingHeroForm}
              setIsAddingHeroForm={setIsAddingHeroForm}
              newHeroForm={newHeroForm}
              setNewHeroForm={setNewHeroForm}
              newHeroError={newHeroError}
              setNewHeroError={setNewHeroError}
              raceQuery={raceQuery}
              setRaceQuery={setRaceQuery}
              isRaceDialogOpen={isRaceDialogOpen}
              setIsRaceDialogOpen={setIsRaceDialogOpen}
              matchingRaces={matchingRaces}
              handleAddHero={handleAddHero}
              heroForms={heroForms}
              heroes={heroes}
              availableItems={availableItems}
              availableSkills={availableSkills}
              availableRaces={availableRaces}
              itemsError={itemsError}
              skillsError={skillsError}
              racesError={racesError}
              isItemsLoading={isItemsLoading}
              isSkillsLoading={isSkillsLoading}
              isRacesLoading={isRacesLoading}
              campaignId={campaignId}
              statFields={statFields}
              skillFields={skillFields}
              onUpdateHeroForm={updateHeroForm}
              onRemoveHeroForm={removeHeroForm}
              onItemCreated={handleItemCreated}
              onSkillCreated={handleSkillCreated}
              onRaceCreated={handleRaceCreated}
              expandedHeroId={expandedHeroId}
              setExpandedHeroId={setExpandedHeroId}
            />
          ) : activeTab === "backstory" ? (
            <BackstoryTab
              warband={warband}
              isWarbandOwner={isWarbandOwner}
              onWarbandUpdated={setWarband}
            />
          ) : (
            <LogsTab warband={warband} />
          )}
        </TabbedCard>
      )}
    </div>
  );
}

type WarbandTabContentProps = ComponentProps<typeof WarbandHeroesSection> & {
  warbandForm: WarbandUpdatePayload;
  onChangeWarbandForm: (nextForm: WarbandUpdatePayload) => void;
  goldCrowns: number;
  rating: number;
  otherResources: WarbandResource[];
  saveMessage: string;
  saveError: string;
  canEdit: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
};

function WarbandTabContent({
  warbandForm,
  onChangeWarbandForm,
  goldCrowns,
  rating,
  otherResources,
  saveMessage,
  saveError,
  canEdit,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  ...heroSectionProps
}: WarbandTabContentProps) {
  const { isEditing } = heroSectionProps;

  return (
    <>
      <WarbandSummaryBar
        goldCrowns={goldCrowns}
        rating={rating}
        otherResources={otherResources}
        saveMessage={saveMessage}
        saveError={saveError}
        canEdit={canEdit}
        isEditing={isEditing}
        isSaving={isSaving}
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
      />

      {isEditing ? (
        <WarbandEditForm warbandForm={warbandForm} onChange={onChangeWarbandForm} />
      ) : null}

      <WarbandHeroesSection {...heroSectionProps} />

      <div className="space-y-3 border-t border-border/60 pt-4">
        <h2 className="text-sm font-semibold text-muted-foreground">henchmen</h2>
        <p className="text-sm text-muted-foreground">
          This section is ready for future entries.
        </p>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <h2 className="text-sm font-semibold text-muted-foreground">hired swords</h2>
        <p className="text-sm text-muted-foreground">
          This section is ready for future entries.
        </p>
      </div>
    </>
  );
}
