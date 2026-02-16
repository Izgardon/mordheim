import { useCallback, useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";

import "../styles/warband.css";

// components
import { CardBackground } from "@components/card-background";
import TabbedCard from "@components/tabbed-card";
import { WarbandPageSkeleton } from "../components/warband/WarbandPageSkeleton";
import CreateWarbandDialog from "../components/shared/dialogs/CreateWarbandDialog";
import BackstoryTab from "../components/tabs/BackstoryTab";
import LogsTab from "../components/tabs/LogsTab";
import TradesTab from "../components/tabs/TradesTab";
import WarbandHeader from "../components/warband/WarbandHeader";
import WarbandTabContent from "../components/warband/WarbandTabContent";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";
import { useCampaignMemberPermissions } from "../hooks/campaign/useCampaignMemberPermissions";
import { useHeroCreationForm } from "../hooks/heroes/useHeroCreationForm";
import { useHeroForms } from "../hooks/heroes/useHeroForms";
import { useWarbandLoader } from "../hooks/warband/useWarbandLoader";
import { useWarbandSave } from "../hooks/warband/useWarbandSave";
import { useWarbandUpdateListener } from "../hooks/warband/useWarbandUpdateListener";
import { useWarbandWarchest } from "../hooks/warband/useWarbandWarchest";

// store
import { useAppStore } from "@/stores/app-store";

// api
import {
  createWarband,
  getWarbandSummary,
  getWarbandHeroDetail,
  listWarbandHeroDetails,
  listWarbandTrades,
} from "../api/warbands-api";

// utils
import {
  getSignedTradePrice,
  mapHeroToForm,
  skillFields,
  statFields,
  toNumber,
  validateHeroForm,
} from "../utils/warband-utils";
import { isPendingByType } from "../components/heroes/utils/pending-entries";
import { getPendingSpend, removePendingPurchase, type PendingPurchase } from "../utils/pending-purchases";

// types
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";
import type { Item } from "../../items/types/item-types";
import type { Skill } from "../../skills/types/skill-types";
import type {
  Warband,
  WarbandCreatePayload,
  WarbandHero,
  WarbandHiredSword,
  WarbandResource,
  WarbandUpdatePayload,
} from "../types/warband-types";

type WarbandTab = "warband" | "trade" | "backstory" | "logs";
const warbandTabs: WarbandTab[] = ["warband", "trade", "backstory", "logs"];

const resolveWarbandTab = (value: string | null): WarbandTab | null =>
  value && warbandTabs.includes(value as WarbandTab) ? (value as WarbandTab) : null;

export default function Warband() {
  const { id, warbandId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { campaign, lookups } = useOutletContext<CampaignLayoutContext>();
  const { warband: storeWarband, setWarband: setStoreWarband } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingHeroDetails, setIsLoadingHeroDetails] = useState(false);
  const activeTab = resolveWarbandTab(searchParams.get("tab")) ?? "warband";
  const [tradeTotal, setTradeTotal] = useState(0);
  const [heroPendingPurchases, setHeroPendingPurchases] = useState<PendingPurchase[]>([]);
  const [pendingEditFocus, setPendingEditFocus] = useState<{ heroId: number; tab: "skills" | "spells" | "special" } | null>(null);
  const [warbandForm, setWarbandForm] = useState<WarbandUpdatePayload>({
    name: "",
    faction: "",
  });

  const campaignId = useMemo(() => Number(id), [id]);
  const resolvedWarbandId = useMemo(() => (warbandId ? Number(warbandId) : null), [warbandId]);
  const hasCampaignId = Boolean(id);
  const isViewingOtherWarband = resolvedWarbandId !== null;

  const handleTabChange = (tabId: string) => {
    const nextTab = resolveWarbandTab(tabId) ?? "warband";
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === "warband") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }
    setSearchParams(nextParams);
  };

  const { warband, setWarband, heroes, setHeroes, hiredSwords, setHiredSwords, isLoading, error } = useWarbandLoader({
    campaignId,
    hasCampaignId,
    resolvedWarbandId,
  });

  const {
    availableItems,
    itemsError,
    isItemsLoading,
    loadItems,
    availableSkills,
    skillsError,
    isSkillsLoading,
    loadSkills,
    availableSpells,
    spellsError,
    isSpellsLoading,
    availableSpecials,
    specialsError,
    isSpecialsLoading,
    availableRaces,
    racesError,
    isRacesLoading,
    handleRaceCreated,
  } = lookups;

  const { memberPermissions } = useCampaignMemberPermissions({ campaignId, campaign });
  const maxHeroes = campaign?.max_heroes ?? 6;
  const maxHiredSwords = campaign?.max_hired_swords ?? 3;

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
    originalHeroFormsRef,
  } = useHeroForms({ heroes, mapHeroToForm });

  const heroErrors = useMemo(
    () => heroForms.map((hero) => validateHeroForm(hero)),
    [heroForms]
  );

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
    maxHeroes,
    availableRaces,
    appendHeroForm,
  });

  useEffect(() => {
    if (warband && !isEditing) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
  }, [warband, isEditing]);

  const isWarbandOwner = Boolean(warband && user && warband.user_id === user.id);
  const hasPermission = (permission: string) =>
    campaign?.role === "owner" ||
    campaign?.role === "admin" ||
    memberPermissions.includes(permission);
  const canEdit = Boolean(warband) && (isWarbandOwner || hasPermission("manage_warbands"));
  const canAddCustom = hasPermission("add_custom");

  const handleSaveSuccess = useCallback(
    (updatedWarband: Warband, refreshedHeroes: WarbandHero[]) => {
      setWarband((current) =>
        current ? { ...current, ...updatedWarband } : updatedWarband
      );
      setHeroes(refreshedHeroes);
      const nextStoreWarband = warband
        ? { ...warband, ...updatedWarband, heroes: refreshedHeroes }
        : { ...updatedWarband, heroes: refreshedHeroes };
      setStoreWarband(nextStoreWarband);
      resetHeroForms();
      resetHeroCreationForm();
      setIsEditing(false);
      setExpandedHeroId(null);
      setPendingEditFocus(null);
      setHeroPendingPurchases([]);
    },
    [
      setWarband,
      setHeroes,
      resetHeroForms,
      resetHeroCreationForm,
      setExpandedHeroId,
      setStoreWarband,
      warband,
    ]
  );

  const {
    isSaving,
    saveError,
    setSaveError,
    hasAttemptedSave,
    setHasAttemptedSave,
    handleSaveChanges,
  } = useWarbandSave({
    warband,
    canEdit,
    warbandForm,
    heroForms,
    removedHeroIds,
    isAddingHeroForm,
    newHeroForm,
    raceQuery,
    originalHeroFormsRef,
    onSuccess: handleSaveSuccess,
    pendingPurchases: heroPendingPurchases,
    onPendingCleared: () => setHeroPendingPurchases([]),
  });

  const heroPendingSpend = useMemo(
    () => getPendingSpend(heroPendingPurchases),
    [heroPendingPurchases]
  );

  const handleHeroPendingPurchaseAdd = useCallback(
    (purchase: PendingPurchase) => {
      setHeroPendingPurchases((prev) => [...prev, purchase]);
    },
    []
  );

  const handleHeroPendingPurchaseRemove = useCallback(
    (match: { unitType: "heroes" | "henchmen" | "hiredswords" | "stash"; unitId: string; itemId: number }) => {
      setHeroPendingPurchases((prev) => removePendingPurchase(prev, match));
    },
    []
  );

  const warbandResources = warband?.resources ?? [];

  const refreshTradeTotal = useCallback(
    async (targetWarbandId: number) => {
      const trades = await listWarbandTrades(targetWarbandId);
      return trades.reduce((sum, trade) => sum + getSignedTradePrice(trade), 0);
    },
    []
  );

  useEffect(() => {
    if (!warband?.id) {
      return;
    }
    refreshTradeTotal(warband.id)
      .then((total) => setTradeTotal(total))
      .catch(() => setTradeTotal(0));
  }, [refreshTradeTotal, warband?.id]);

  useWarbandUpdateListener({
    warbandId: warband?.id,
    refreshTradeTotal,
    setTradeTotal,
    setWarband,
    setHeroes,
    setHiredSwords,
  });


  const handleResourcesUpdated = useCallback(
    (nextResources: WarbandResource[]) => {
      setWarband((current) =>
        current ? { ...current, resources: nextResources } : current
      );
      if (storeWarband && storeWarband.id === warband?.id) {
        setStoreWarband({ ...storeWarband, resources: nextResources });
      }
    },
    [setStoreWarband, setWarband, storeWarband, warband?.id]
  );

  const warbandRating = useMemo(() => {
    const heroRating = heroes.reduce((total, hero) => {
      const base = hero.large ? 20 : 5;
      const xp = toNumber(hero.xp);
      return total + base + xp;
    }, 0);

    const hiredSwordRating = hiredSwords.reduce((total, hiredSword) => {
      const base = toNumber(hiredSword.rating ?? 0);
      const xp = toNumber(hiredSword.xp);
      return total + base + xp;
    }, 0);

    if (heroes.length || hiredSwords.length) {
      return heroRating + hiredSwordRating;
    }
    if (typeof warband?.rating === "number") {
      return warband.rating;
    }
    return 0;
  }, [heroes, hiredSwords, warband?.rating]);

  const {
    isWarchestOpen,
    warchestItems,
    isWarchestLoading,
    warchestError,
    loadWarchestItems,
    toggleWarchest,
    closeWarchest,
  } = useWarbandWarchest(warband?.id);

  const handleCreate = async (payload: WarbandCreatePayload) => {
    if (!id) {
      return;
    }

    if (Number.isNaN(campaignId) || isViewingOtherWarband) {
      return;
    }

    const created = await createWarband(campaignId, payload);
    let nextWarband = created;
    try {
      const summary = await getWarbandSummary(created.id);
      nextWarband = { ...created, ...summary };
    } catch {
      /* keep base warband data if summary fetch fails */
    }
    setWarband(nextWarband);
    setHeroes([]);
    setHiredSwords([]);
    setIsEditing(false);
    setSaveError("");
    resetHeroForms();
    resetHeroCreationForm();
    setWarbandForm({ name: created.name, faction: created.faction });
  };

  const startEditing = async () => {
    if (!canEdit || !warband) {
      return;
    }

    setSaveError("");
    setHasAttemptedSave(false);
    setHeroPendingPurchases([]);
    setWarbandForm({ name: warband.name, faction: warband.faction });

    setIsLoadingHeroDetails(true);
    try {
      const detailedHeroes = await listWarbandHeroDetails(warband.id);
      setHeroes(detailedHeroes);
      initializeHeroForms(detailedHeroes);
      resetHeroCreationForm();
      setIsEditing(true);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSaveError(errorResponse.message || "Unable to load hero details.");
      } else {
        setSaveError("Unable to load hero details.");
      }
    } finally {
      setIsLoadingHeroDetails(false);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    resetHeroForms();
    resetHeroCreationForm();
    setSaveError("");
    setHasAttemptedSave(false);
    setPendingEditFocus(null);
    setHeroPendingPurchases([]);
    if (warband) {
      setWarbandForm({ name: warband.name, faction: warband.faction });
    }
  };

  const hasHeroDetail = useCallback((hero: (typeof heroes)[number]) => {
    return (
      hero.race !== undefined ||
      hero.deeds !== undefined ||
      hero.kills !== undefined ||
      hero.large !== undefined
    );
  }, []);

  const loadHeroDetail = useCallback(
    async (heroId: number) => {
      if (!warband) {
        return;
      }
      const existing = heroes.find((hero) => hero.id === heroId);
      if (!existing || hasHeroDetail(existing)) {
        return;
      }
      try {
        const detail = await getWarbandHeroDetail(warband.id, heroId);
        setHeroes((prev) =>
          prev.map((hero) => (hero.id === heroId ? { ...hero, ...detail } : hero))
        );
      } catch {
        // Keep summary data if detail fetch fails.
      }
    },
    [hasHeroDetail, heroes, warband, setHeroes]
  );

  const handleToggleHero = useCallback(
    (heroId: number) => {
      if (expandedHeroId === heroId) {
        setExpandedHeroId(null);
        return;
      }
      setExpandedHeroId(heroId);
      loadHeroDetail(heroId);
    },
    [expandedHeroId, loadHeroDetail, setExpandedHeroId]
  );

  const handleHeroLevelUp = useCallback(
    (updatedHero: WarbandHero) => {
      setHeroes((prev) =>
        prev.map((hero) =>
          hero.id === updatedHero.id ? updatedHero : hero
        )
      );
    },
    [setHeroes]
  );

  const handleHiredSwordUpdated = useCallback(
    (updatedHiredSword: WarbandHiredSword) => {
      setHiredSwords((prev) =>
        prev.map((entry) =>
          entry.id === updatedHiredSword.id ? updatedHiredSword : entry
        )
      );
    },
    [setHiredSwords]
  );

  const handlePendingEntryClick = useCallback(
    async (heroId: number, tab: "skills" | "spells" | "special") => {
      setPendingEditFocus({ heroId, tab });
      await startEditing();
    },
    [startEditing]
  );

  const handleItemCreated = (_index: number, _item: Item) => {
    loadItems();
  };

  const handleSkillCreated = (index: number, skill: Skill) => {
    loadSkills();
    updateHeroForm(index, (current) => {
      const pendingIdx = current.skills.findIndex((s) => isPendingByType(s));
      const cleaned = pendingIdx !== -1 ? current.skills.filter((_, i) => i !== pendingIdx) : current.skills;
      return { ...current, skills: [...cleaned, skill] };
    });
  };

  const handleRemoveHeroForm = useCallback(
    (index: number) => {
      const heroId = heroForms[index]?.id;
      if (heroId) {
        setHeroPendingPurchases((prev) =>
          prev.filter((entry) => entry.unitId !== String(heroId))
        );
      }
      removeHeroForm(index);
    },
    [heroForms, removeHeroForm]
  );

  return (
    <div className="min-h-0 space-y-6">
      {isLoading ? (
        <WarbandPageSkeleton />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !warband ? (
        <CardBackground className="mt-20 p-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isViewingOtherWarband
                ? "No warband found for this record."
                : "No warband created for this campaign yet."}
            </p>
            {!isViewingOtherWarband ? <CreateWarbandDialog onCreate={handleCreate} /> : null}
          </div>
        </CardBackground>
      ) : (
        <>
        <WarbandHeader
          warband={warband}
          goldCrowns={tradeTotal}
          rating={warbandRating}
          tabs={[
            { id: "warband" as WarbandTab, label: "Warband" },
            { id: "trade" as WarbandTab, label: "Trade" },
            { id: "backstory" as WarbandTab, label: "Backstory" },
            { id: "logs" as WarbandTab, label: "Logs" },
          ]}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onWarchestClick={toggleWarchest}
          isWarchestOpen={isWarchestOpen}
          warchestItems={warchestItems}
          isWarchestLoading={isWarchestLoading}
          warchestError={warchestError}
          onWarchestClose={closeWarchest}
          onWarchestItemsChanged={loadWarchestItems}
          onHeroUpdated={handleHeroLevelUp}
        />
        <TabbedCard
          tabs={[
            { id: "warband" as WarbandTab, label: "Warband" },
            { id: "trade" as WarbandTab, label: "Trade" },
            { id: "backstory" as WarbandTab, label: "Backstory" },
            { id: "logs" as WarbandTab, label: "Logs" },
          ]}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabsClassName="hidden"
          contentClassName="pt-6"
        >
          {activeTab === "warband" ? (
            <WarbandTabContent
              warbandId={warband.id}
              resources={warbandResources}
              onResourcesUpdated={handleResourcesUpdated}
              saveError={saveError}
              canEdit={canEdit}
              isEditing={isEditing}
              isSaving={isSaving}
              onSave={handleSaveChanges}
              onCancel={cancelEditing}
              onEditHeroes={startEditing}
              isLoadingHeroDetails={isLoadingHeroDetails}
              isHeroLimitReached={isHeroLimitReached}
              maxHeroes={maxHeroes}
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
              availableSpells={availableSpells}
              availableSpecials={availableSpecials}
              availableRaces={availableRaces}
              canAddCustom={canAddCustom}
              itemsError={itemsError}
              skillsError={skillsError}
              spellsError={spellsError}
              specialsError={specialsError}
              racesError={racesError}
              isItemsLoading={isItemsLoading}
              isSkillsLoading={isSkillsLoading}
              isSpellsLoading={isSpellsLoading}
              isSpecialsLoading={isSpecialsLoading}
              isRacesLoading={isRacesLoading}
              campaignId={campaignId}
              statFields={statFields}
              skillFields={skillFields}
              onUpdateHeroForm={updateHeroForm}
              onRemoveHeroForm={handleRemoveHeroForm}
              onItemCreated={handleItemCreated}
              onSkillCreated={handleSkillCreated}
              onRaceCreated={handleRaceCreated}
              expandedHeroId={expandedHeroId}
              setExpandedHeroId={setExpandedHeroId}
              onToggleHero={handleToggleHero}
              onHeroLevelUp={handleHeroLevelUp}
              onHiredSwordUpdated={handleHiredSwordUpdated}
              onHiredSwordsChange={setHiredSwords}
              heroErrors={hasAttemptedSave ? heroErrors : []}
              onPendingEntryClick={handlePendingEntryClick}
              pendingEditFocus={pendingEditFocus}
              maxHiredSwords={maxHiredSwords}
              availableGold={tradeTotal}
              pendingSpend={heroPendingSpend}
              onPendingPurchaseAdd={handleHeroPendingPurchaseAdd}
              onPendingPurchaseRemove={handleHeroPendingPurchaseRemove}
            />
          ) : activeTab === "trade" ? (
            <TradesTab
              warband={warband}
              canEdit={canEdit}
              onTradeCreated={(trade) => setTradeTotal((prev) => prev + getSignedTradePrice(trade))}
            />
          ) : activeTab === "backstory" ? (
            <BackstoryTab
              warband={warband}
              isWarbandOwner={isWarbandOwner}
              onWarbandUpdated={(updated) =>
                setWarband((current) =>
                  current ? { ...current, ...updated } : updated
                )
              }
            />
          ) : (
            <LogsTab warband={warband} />
          )}
        </TabbedCard>
        </>
      )}

    </div>
  );
}
