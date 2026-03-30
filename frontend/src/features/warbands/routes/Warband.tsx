import { useCallback, useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";

import "../styles/warband.css";

// components
import { CardBackground } from "@components/card-background";
import { Button } from "@components/button";
import { PageSubnav } from "@/components/ui/page-subnav";
import TabbedCard from "@components/tabbed-card";
import { WarbandPageSkeleton } from "../components/warband/WarbandPageSkeleton";
import CreateWarbandDialog from "../components/shared/dialogs/CreateWarbandDialog";
import BackstoryTab from "../components/tabs/BackstoryTab";
import LogsTab from "../components/tabs/LogsTab";
import TradesTab from "../components/tabs/TradesTab";
import TradeInviteDialog from "../components/trade/TradeInviteDialog";
import TradeSessionDialog from "../components/trade/TradeSessionDialog";
import WarbandTabContent from "../components/warband/WarbandTabContent";
import WarbandMobileMetaBar from "../components/warband/WarbandMobileMetaBar";
import HeaderIconButton from "../components/warband/HeaderIconButton";
import StashItemList from "../components/warband/stash/StashItemList";
import WarbandPdfViewerDialog from "../components/warband/WarbandPdfViewerDialog";
import WarbandRatingDialog from "../components/warband/WarbandRatingDialog";

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
import greedIcon from "@/assets/icons/greed.webp";
import ratingIcon from "@/assets/icons/Menu.webp";
import { BookOpen, Handshake } from "lucide-react";
import { ChestClosedIcon, ChestOpenIcon } from "../components/warband/chest-icons";

// api
import {
  createWarband,
  createWarbandHero,
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

type WarbandTab = "warband" | "treasury" | "backstory" | "logs";
const warbandTabs: WarbandTab[] = ["warband", "treasury", "backstory", "logs"];

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
  const [isDesktopRatingOpen, setIsDesktopRatingOpen] = useState(false);
  const [isDesktopPdfOpen, setIsDesktopPdfOpen] = useState(false);

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

  const {
    warband,
    setWarband,
    heroes,
    setHeroes,
    hiredSwords,
    setHiredSwords,
    henchmenGroups,
    setHenchmenGroups,
    isLoading,
    error,
  } =
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
    setLeaderHeroForm,
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
    heroPendingChanges,
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
          is_leader: formEntry.is_leader,
          armour_save: null,
          large: formEntry.large,
          caster: formEntry.caster,
          half_rate: formEntry.half_rate,
          available_skills: formEntry.available_skills,
          ...buildStatPayload(formEntry),
          items: [],
          skill_ids: [],
          special_ids: [],
          spell_ids: [],
        },
        { emitUpdate: false }
      );
      const heroFormEntry = mapHeroToForm(created);
      appendHeroForm(heroFormEntry);
      originalHeroFormsRef.current?.set(created.id, JSON.stringify(heroFormEntry));
      setHeroes((prev) => [...prev, created]);
      setExpandedHeroId(created.id);
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
    setHenchmenGroups,
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
    () => calculateWarbandRating(heroes, hiredSwords, henchmenGroups, warband?.rating),
    [heroes, hiredSwords, henchmenGroups, warband?.rating],
  );

  const maxUnits = warband?.max_units ?? 15;
  const bloodPactedCount = useMemo(
    () => hiredSwords.filter((hs) => hs.blood_pacted).length,
    [hiredSwords],
  );
  const henchmenSnapshotCount = useMemo(
    () => henchmenGroups.reduce(
      (total, g) => total + (g.henchmen?.length ?? 0),
      0,
    ),
    [henchmenGroups],
  );
  // nonHeroUnitCount: passed to heroes section so it can compute total = heroCount + nonHeroUnitCount
  const nonHeroUnitCount = henchmenSnapshotCount + bloodPactedCount;
  // heroAndBloodPactedCount: passed to henchmen section so it can compute total = henchmenCount + heroAndBloodPactedCount
  const heroAndBloodPactedCount = heroes.length + bloodPactedCount;

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
    setHenchmenGroups([]);
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
            {!isViewingOtherWarband ? <CreateWarbandDialog campaignId={campaignId} onCreate={handleCreate} /> : null}
          </div>
        </CardBackground>
      ) : (
        <>
          {!isMobile ? (
            <PageSubnav
              title={warband.name}
              subtitle={warband.faction}
              tabs={[
                { id: "warband" as WarbandTab, label: "Warband" },
                { id: "treasury" as WarbandTab, label: "Treasury" },
                { id: "backstory" as WarbandTab, label: "Backstory" },
                { id: "logs" as WarbandTab, label: "Logs" },
              ]}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              meta={
                <>
                  <HeaderIconButton
                    icon={greedIcon}
                    label={tradeTotal}
                    tooltip="Gold coins"
                    ariaLabel="Gold coins"
                  />
                  <WarbandRatingDialog
                    open={false}
                    onOpenChange={() => undefined}
                    heroes={heroes}
                    hiredSwords={hiredSwords}
                    henchmenGroups={henchmenGroups}
                  />
                  <HeaderIconButton
                    icon={ratingIcon}
                    label={warbandRating}
                    tooltip="Warband rating"
                    ariaLabel="Warband rating"
                    onClick={() => setIsDesktopRatingOpen(true)}
                  />
                  <WarbandRatingDialog
                    open={isDesktopRatingOpen}
                    onOpenChange={setIsDesktopRatingOpen}
                    heroes={heroes}
                    hiredSwords={hiredSwords}
                    henchmenGroups={henchmenGroups}
                  />
                </>
              }
              actions={
                <>
                  <div className="relative">
                    <Button
                      type="button"
                      variant="toolbar"
                      className="h-9 gap-2 px-3 text-xs"
                      onClick={toggleWarchest}
                      aria-label="Warband stash"
                    >
                      {isWarchestOpen ? (
                        <ChestOpenIcon className="h-4 w-4" />
                      ) : (
                        <ChestClosedIcon className="h-4 w-4" />
                      )}
                      <span>Stash</span>
                    </Button>
                    <section
                      className={`warchest-float ${isWarchestOpen ? "is-open" : ""}`}
                      aria-hidden={!isWarchestOpen}
                    >
                      <StashItemList
                        items={warchestItems}
                        warbandId={warband.id}
                        isLoading={isWarchestLoading}
                        error={warchestError}
                        onClose={closeWarchest}
                        onItemsChanged={loadWarchestItems}
                        onHeroUpdated={handleHeroLevelUp}
                        canEdit={canEdit}
                      />
                    </section>
                  </div>
                  {canInitiateTrade ? (
                    <TradeInviteDialog
                      campaignId={campaignId}
                      currentUserId={user?.id}
                      onCreateTradeRequest={handleTradeRequestCreated}
                      trigger={
                        <Button
                          type="button"
                          variant="toolbar"
                          className="h-9 gap-2 px-3 text-xs"
                          aria-label="Start trade"
                        >
                          <Handshake className="h-4 w-4" aria-hidden="true" />
                          <span>Trade</span>
                        </Button>
                      }
                    />
                  ) : null}
                  {warband.warband_link ? (
                    <>
                      <Button
                        type="button"
                        variant="toolbar"
                        className="h-9 gap-2 px-3 text-xs"
                        onClick={() => setIsDesktopPdfOpen(true)}
                        aria-label="View warband PDF"
                      >
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                        <span>Sheet</span>
                      </Button>
                      <WarbandPdfViewerDialog
                        open={isDesktopPdfOpen}
                        onOpenChange={setIsDesktopPdfOpen}
                        url={warband.warband_link}
                        title={warband.name}
                      />
                    </>
                  ) : null}
                </>
              }
            />
          ) : null}
          {isMobile ? (
            <div className="mt-3 px-2">
              <WarbandMobileMetaBar
                warbandId={warband.id}
                warbandLink={warband.warband_link}
                warbandName={warband.name}
                tradeTotal={tradeTotal}
                warbandRating={warbandRating}
                heroes={heroes}
                hiredSwords={hiredSwords}
                henchmenGroups={henchmenGroups}
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
            warbandId={warband.id}
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
              { id: "treasury" as WarbandTab, label: "Treasury" },
              { id: "backstory" as WarbandTab, label: "Backstory" },
              { id: "logs" as WarbandTab, label: "Logs" },
            ]}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            tabsClassName={isMobile ? undefined : "hidden"}
            className="pb-6"
            contentClassName={isMobile ? "space-y-4 pt-2" : "pt-0"}
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
                onSetLeaderHeroForm={setLeaderHeroForm}
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
                maxUnits={maxUnits}
                nonHeroUnitCount={nonHeroUnitCount}
                heroAndBloodPactedCount={heroAndBloodPactedCount}
                availableGold={tradeTotal}
                pendingSpend={heroPendingSpend}
                pendingChanges={heroPendingChanges}
                onPendingPurchaseAdd={handleHeroPendingPurchaseAdd}
                onPendingPurchaseRemove={handleHeroPendingPurchaseRemove}
                heroLevelThresholds={heroLevelThresholds}
                henchmenLevelThresholds={henchmenLevelThresholds}
                hiredSwordLevelThresholds={hiredSwordLevelThresholds}
                onHenchmenGroupsChanged={setHenchmenGroups}
                hideEditActions={isMobileEditing}
                onHenchmenMobileEditChange={(state) => handleMobileEditChange("henchmen", state)}
                onHiredSwordsMobileEditChange={(state) => handleMobileEditChange("hiredswords", state)}
                layoutVariant={isMobile ? "mobile" : "default"}
                showLoadoutOnMobile={warband.show_loadout_on_mobile ?? false}
              />
            ) : activeTab === "treasury" ? (
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
