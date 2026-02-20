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
import TradeInviteDialog from "../components/trade/TradeInviteDialog";
import TradeSessionDialog from "../components/trade/TradeSessionDialog";
import WarbandTabContent from "../components/warband/WarbandTabContent";
import WarbandMobileMetaBar from "../components/warband/WarbandMobileMetaBar";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";
import { useCampaignMemberPermissions } from "../hooks/campaign/useCampaignMemberPermissions";
import { useHeroCreationForm } from "../hooks/heroes/useHeroCreationForm";
import { useHeroForms } from "../hooks/heroes/useHeroForms";
import { useWarbandLoader } from "../hooks/warband/useWarbandLoader";
import { useWarbandSave } from "../hooks/warband/useWarbandSave";
import { useWarbandUpdateListener } from "../hooks/warband/useWarbandUpdateListener";
import { useWarbandWarchest } from "../hooks/warband/useWarbandWarchest";
import { useWarbandTradeSession } from "../hooks/warband/useWarbandTradeSession";
import { useWarbandEditState } from "../hooks/warband/useWarbandEditState";
import { useWarbandMobileTopBar } from "../hooks/warband/useWarbandMobileTopBar";

// store
import { useAppStore } from "@/stores/app-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { Handshake } from "lucide-react";

// api
import {
  createWarband,
  createWarbandHero,
  createWarbandLog,
  createWarbandTrade,
  getWarbandSummary,
  getWarbandHeroDetail,
  listWarbandHeroDetails,
} from "../api/warbands-api";
import { emitWarbandUpdate } from "../api/warbands-events";

// utils
import {
  buildStatPayload,
  calculateWarbandRating,
  getSignedTradePrice,
  mapHeroToForm,
  skillFields,
  statFields,
  toNullableNumber,
  validateHeroForm,
} from "../utils/warband-utils";
import { isPendingByType } from "../components/heroes/utils/pending-entries";

// types
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";
import type { Item } from "../../items/types/item-types";
import type { Skill } from "../../skills/types/skill-types";
import type {
  HeroFormEntry,
  Warband,
  WarbandCreatePayload,
  WarbandHero,
  WarbandHiredSword,
  WarbandResource,
} from "../types/warband-types";

type WarbandTab = "warband" | "trade" | "backstory" | "logs";
const warbandTabs: WarbandTab[] = ["warband", "trade", "backstory", "logs"];

const resolveWarbandTab = (value: string | null): WarbandTab | null =>
  value && warbandTabs.includes(value as WarbandTab) ? (value as WarbandTab) : null;

export default function Warband() {
  const { id, warbandId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { campaign, lookups, setMobileTopBar } = useOutletContext<CampaignLayoutContext>();
  const {
    warband: storeWarband,
    setWarband: setStoreWarband,
    tradeSession,
  } = useAppStore();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const activeTab = resolveWarbandTab(searchParams.get("tab")) ?? "warband";
  const [tradeTotal, setTradeTotal] = useState(0);

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
    setSearchParams(nextParams, { replace: true });
  };

  // ── Data loading ────────────────────────────────────────────────────────────

  const { warband, setWarband, heroes, setHeroes, hiredSwords, setHiredSwords, isLoading, error } =
    useWarbandLoader({ campaignId, hasCampaignId, resolvedWarbandId });

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
  const heroLevelThresholds = campaign?.hero_level_thresholds;
  const henchmenLevelThresholds = campaign?.henchmen_level_thresholds;
  const hiredSwordLevelThresholds = campaign?.hired_sword_level_thresholds;

  // ── Hero forms ───────────────────────────────────────────────────────────────

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

  // ── Edit state ───────────────────────────────────────────────────────────────

  const {
    isEditing,
    setIsEditing,
    isLoadingHeroDetails,
    setIsLoadingHeroDetails,
    warbandForm,
    setWarbandForm,
    heroPendingPurchases,
    setHeroPendingPurchases,
    pendingEditFocus,
    setPendingEditFocus,
    heroPendingSpend,
    handleHeroPendingPurchaseAdd,
    handleHeroPendingPurchaseRemove,
  } = useWarbandEditState(warband);

  const appendHeroFormAsync = useCallback(
    async (formEntry: HeroFormEntry) => {
      if (!warband) {
        appendHeroForm(formEntry);
        return;
      }
      const created = await createWarbandHero(
        warband.id,
        {
          name: formEntry.name.trim() || null,
          unit_type: formEntry.unit_type.trim() || null,
          race: formEntry.race_id ?? null,
          price: toNullableNumber(formEntry.price) ?? 0,
          xp: toNullableNumber(formEntry.xp) ?? 0,
          deeds: null,
          armour_save: null,
          large: formEntry.large,
          caster: formEntry.caster,
          half_rate: formEntry.half_rate,
          available_skills: formEntry.available_skills,
          ...buildStatPayload(formEntry),
          item_ids: [],
          skill_ids: [],
          special_ids: [],
          spell_ids: [],
        },
        { emitUpdate: false }
      );
      const heroFormEntry = { ...formEntry, id: created.id };
      appendHeroForm(heroFormEntry);
      originalHeroFormsRef.current?.set(created.id, JSON.stringify(heroFormEntry));
      setHeroes((prev) => [...prev, created]);
      setExpandedHeroId(created.id);
      const recruitPrice = toNullableNumber(formEntry.price) ?? 0;
      if (recruitPrice > 0) {
        const heroName = created.name?.trim() || formEntry.name;
        await createWarbandTrade(warband.id, {
          action: "Recruit",
          description: heroName,
          price: recruitPrice,
        }, { emitUpdate: false });
        await createWarbandLog(warband.id, {
          feature: "roster",
          entry_type: "hero_recruit",
          payload: { hero: heroName, price: recruitPrice },
        }, { emitUpdate: false });
      }
      emitWarbandUpdate(warband.id);
    },
    [warband, appendHeroForm, originalHeroFormsRef, setHeroes, setExpandedHeroId]
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
    appendHeroForm: appendHeroFormAsync,
  });

  // ── Permissions ──────────────────────────────────────────────────────────────

  const isWarbandOwner = Boolean(warband && user && warband.user_id === user.id);
  const hasPermission = (permission: string) =>
    campaign?.role === "owner" ||
    campaign?.role === "admin" ||
    memberPermissions.includes(permission);
  const canEdit = Boolean(warband) && (isWarbandOwner || hasPermission("manage_warbands"));
  const canAddCustom = hasPermission("add_custom");

  // ── Save ─────────────────────────────────────────────────────────────────────

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
      setIsEditing,
      setPendingEditFocus,
      setHeroPendingPurchases,
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

  // ── Warchest ─────────────────────────────────────────────────────────────────

  const warbandResources = warband?.resources ?? [];
  const {
    isWarchestOpen,
    warchestItems,
    isWarchestLoading,
    warchestError,
    loadWarchestItems,
    toggleWarchest,
    closeWarchest,
  } = useWarbandWarchest(warband?.id);

  // ── Trade session ─────────────────────────────────────────────────────────────

  const { tradeRequest, setTradeRequest, handleTradeRequestCreated, handleTradeSessionClose } =
    useWarbandTradeSession({
      campaignId,
      hasCampaignId,
      warbandId: warband?.id,
      loadWarchestItems,
    });

  // ── Mobile top bar ────────────────────────────────────────────────────────────

  const { handleMobileEditChange, isMobileEditing } = useWarbandMobileTopBar({
    isMobile,
    isEditing,
    isSaving,
    handleSaveChanges,
    cancelEditing,
    setMobileTopBar,
    warbandName: warband?.name,
  });

  // ── Gold initialisation & live updates ───────────────────────────────────────

  useEffect(() => {
    if (warband?.gold !== undefined) {
      setTradeTotal(warband.gold);
    }
  }, [warband?.id]);

  useWarbandUpdateListener({
    warbandId: warband?.id,
    setTradeTotal,
    setWarband,
    setHeroes,
    setHiredSwords,
  });

  // ── Misc callbacks ────────────────────────────────────────────────────────────

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

  const warbandRating = useMemo(
    () => calculateWarbandRating(heroes, hiredSwords, warband?.rating),
    [heroes, hiredSwords, warband?.rating],
  );
  const canInitiateTrade = Boolean(
    user && warband && !isViewingOtherWarband && hasCampaignId && !Number.isNaN(campaignId)
  );

  const handleCreate = async (payload: WarbandCreatePayload) => {
    if (!id || Number.isNaN(campaignId) || isViewingOtherWarband) {
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
        prev.map((hero) => (hero.id === updatedHero.id ? updatedHero : hero))
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
    [heroForms, removeHeroForm, setHeroPendingPurchases]
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-0 space-y-6">
      {isLoading ? (
        <WarbandPageSkeleton variant={isMobile ? "mobile" : "default"} />
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
            canEdit={canEdit}
            tradeAction={
              canInitiateTrade ? (
                <TradeInviteDialog
                  campaignId={campaignId}
                  currentUserId={user?.id}
                  onCreateTradeRequest={handleTradeRequestCreated}
                  trigger={
                    <button
                      type="button"
                    className="icon-button flex h-5 w-5 items-center justify-center border-none bg-transparent p-0 transition-[filter] hover:brightness-150"
                    aria-label="Start trade"
                  >
                    <Handshake className="h-4 w-4 text-[#c9b48a]" aria-hidden="true" />
                  </button>
                }
              />
              ) : null
            }
          />
          {isMobile ? (
            <div className="mt-3 px-2">
              <WarbandMobileMetaBar
                warbandId={warband.id}
                tradeTotal={tradeTotal}
                warbandRating={warbandRating}
                canEdit={canEdit}
                canInitiateTrade={canInitiateTrade}
                campaignId={campaignId}
                userId={user?.id}
                isWarchestOpen={isWarchestOpen}
                isWarchestLoading={isWarchestLoading}
                warchestItems={warchestItems}
                warchestError={warchestError}
                onToggleWarchest={toggleWarchest}
                onCloseWarchest={closeWarchest}
                onWarchestItemsChanged={loadWarchestItems}
                onHeroUpdated={handleHeroLevelUp}
                onCreateTradeRequest={handleTradeRequestCreated}
              />
            </div>
          ) : null}
          <TradeSessionDialog
            session={tradeSession}
            tradeRequest={tradeRequest}
            heroes={heroes}
            warchestItems={warchestItems}
            isWarchestLoading={isWarchestLoading}
            warchestError={warchestError}
            availableGold={tradeTotal}
            onRequestUpdated={setTradeRequest}
            onClose={handleTradeSessionClose}
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
            tabsClassName={isMobile ? undefined : "hidden"}
            className={isMobile ? "px-2" : undefined}
            contentClassName={isMobile ? "space-y-4 pt-2" : "pt-6"}
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
                heroLevelThresholds={heroLevelThresholds}
                henchmenLevelThresholds={henchmenLevelThresholds}
                hiredSwordLevelThresholds={hiredSwordLevelThresholds}
                hideEditActions={isMobileEditing}
                onHenchmenMobileEditChange={(state) => handleMobileEditChange("henchmen", state)}
                onHiredSwordsMobileEditChange={(state) => handleMobileEditChange("hiredswords", state)}
                layoutVariant={isMobile ? "mobile" : "default"}
              />
            ) : activeTab === "trade" ? (
              <TradesTab
                warband={warband}
                canEdit={canEdit}
                isMobile={isMobile}
                onTradeCreated={(trade) => setTradeTotal((prev) => prev + getSignedTradePrice(trade))}
              />
            ) : activeTab === "backstory" ? (
              <BackstoryTab
                warband={warband}
                isWarbandOwner={isWarbandOwner}
                isMobile={isMobile}
                onWarbandUpdated={(updated) =>
                  setWarband((current) =>
                    current ? { ...current, ...updated } : updated
                  )
                }
              />
            ) : (
              <LogsTab warband={warband} isMobile={isMobile} />
            )}
          </TabbedCard>
        </>
      )}
    </div>
  );
}
