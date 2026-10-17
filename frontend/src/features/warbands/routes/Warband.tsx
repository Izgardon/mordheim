import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import "../styles/warband.css";

import TabbedCard from "@components/tabbed-card";
import BackstoryTab from "../components/tabs/BackstoryTab";
import LogsTab from "../components/tabs/LogsTab";
import TradesTab from "../components/tabs/TradesTab";
import TradeSessionDialog from "../components/trade/TradeSessionDialog";
import WarbandTabContent from "../components/warband/WarbandTabContent";
import WarbandMobileMetaBar from "../components/warband/WarbandMobileMetaBar";
import WarbandDesktopHeader from "../components/warband/WarbandDesktopHeader";
import WarbandPageStatus from "../components/warband/WarbandPageStatus";
import { WarbandCatalogueProvider } from "../components/units/catalogue-context";
import { useWarbandAccess } from "../hooks/warband/useWarbandAccess";
import { useWarbandLoader } from "../hooks/warband/useWarbandLoader";
import { useWarbandUpdateListener } from "../hooks/warband/useWarbandUpdateListener";
import { useWarbandWarchest } from "../hooks/warband/useWarbandWarchest";
import { useWarbandTradeSession } from "../hooks/warband/useWarbandTradeSession";
import { WARBAND_TABS, useWarbandPage } from "../hooks/warband/useWarbandPage";
import { useWarbandStoreMirror } from "../hooks/warband/useWarbandStoreMirror";
import { useAppStore } from "@/stores/app-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { createWarband, getWarbandSummary } from "../api/warbands-api";
import { calculateWarbandRating, getSignedTradePrice } from "../utils/warband-utils";

import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";
import type { Warband, WarbandCreatePayload, WarbandHero } from "../types/warband-types";

export default function Warband() {
  const { id, warbandId } = useParams();
  const { campaign, setMobileTopBar, showRejoinBattleButton } =
    useOutletContext<CampaignLayoutContext>();
  const { warband: storeWarband, setWarband: setStoreWarband, tradeSession } = useAppStore();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [tradeTotal, setTradeTotal] = useState(0);

  const campaignId = useMemo(() => Number(id), [id]);
  const resolvedWarbandId = useMemo(() => (warbandId ? Number(warbandId) : null), [warbandId]);
  const hasCampaignId = Boolean(id);
  const isViewingOtherWarband = resolvedWarbandId !== null;
  const initialWarband = useMemo(() => {
    if (!storeWarband || storeWarband.campaign_id !== campaignId) {
      return null;
    }
    if (resolvedWarbandId !== null && storeWarband.id !== resolvedWarbandId) {
      return null;
    }
    return storeWarband;
  }, [campaignId, resolvedWarbandId, storeWarband]);

  const loader = useWarbandLoader({ campaignId, hasCampaignId, resolvedWarbandId, initialWarband });
  const { warband, setWarband, heroes, setHeroes, hiredSwords, henchmenGroups } = loader;

  const access = useWarbandAccess(campaignId, campaign?.role, warband);
  const { user, isWarbandOwner, canEdit } = access;

  const mergeWarband = useCallback(
    (updated: Partial<Warband>) =>
      setWarband((current) => (current ? { ...current, ...updated } : (updated as Warband))),
    [setWarband]
  );
  const page = useWarbandPage({
    campaign,
    warband,
    roster: { hero: heroes, henchmen_group: henchmenGroups, hired_sword: hiredSwords },
    setUnits: {
      hero: setHeroes,
      henchmen_group: loader.setHenchmenGroups,
      hired_sword: loader.setHiredSwords,
    },
    onWarbandSaved: mergeWarband,
    canEdit,
    isMobile,
    isLoadingWarband: loader.isLoading,
    setMobileTopBar,
    hasRejoinButton: showRejoinBattleButton,
  });

  const warchest = useWarbandWarchest(warband?.id);
  const trade = useWarbandTradeSession({
    campaignId,
    hasCampaignId,
    warbandId: warband?.id,
    loadWarchestItems: warchest.loadWarchestItems,
  });

  useEffect(() => {
    if (warband?.gold !== undefined) {
      setTradeTotal(warband.gold);
    }
  }, [warband?.gold]);

  useWarbandUpdateListener({
    warbandId: warband?.id,
    setTradeTotal,
    setWarband,
    setHeroes,
    setHiredSwords: loader.setHiredSwords,
    setHenchmenGroups: loader.setHenchmenGroups,
    setWarchestItems: warchest.setWarchestItems,
  });
  const roster = { heroes, hiredSwords, henchmenGroups };
  useWarbandStoreMirror({
    campaignId,
    isViewingOtherWarband,
    warband,
    roster,
    storeWarband,
    setStoreWarband,
  });

  const replaceHero = useCallback(
    (updated: WarbandHero) =>
      setHeroes((prev) => prev.map((hero) => (hero.id === updated.id ? updated : hero))),
    [setHeroes]
  );
  const warbandRating = useMemo(
    () => calculateWarbandRating(heroes, hiredSwords, henchmenGroups, warband?.rating),
    [heroes, hiredSwords, henchmenGroups, warband?.rating]
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
      nextWarband = { ...created, ...(await getWarbandSummary(created.id)) };
    } catch {
      /* keep base warband data if summary fetch fails */
    }
    setWarband(nextWarband);
    setHeroes([]);
    loader.setHiredSwords([]);
    loader.setHenchmenGroups([]);
    setStoreWarband(nextWarband);
  };

  if (loader.isLoading || loader.error || !warband) {
    return (
      <WarbandPageStatus
        isLoading={loader.isLoading}
        error={loader.error}
        isMobile={isMobile}
        isViewingOtherWarband={isViewingOtherWarband}
        campaignId={campaignId}
        onCreate={handleCreate}
      />
    );
  }

  const stash = {
    isOpen: warchest.isWarchestOpen,
    isLoading: warchest.isWarchestLoading,
    items: warchest.warchestItems,
    error: warchest.warchestError,
    onToggle: warchest.toggleWarchest,
    onClose: warchest.closeWarchest,
    onItemsChanged: warchest.loadWarchestItems,
    onHeroUpdated: replaceHero,
  };
  const header = { warband, tradeTotal, warbandRating, ...roster, canEdit, canInitiateTrade };
  return (
    <div className="min-h-0 space-y-6">
      {isMobile ? (
        <div className="mt-3 px-2">
          <WarbandMobileMetaBar
            {...header}
            campaignId={campaignId}
            userId={user?.id}
            stash={stash}
            onCreateTradeRequest={trade.handleTradeRequestCreated}
          />
        </div>
      ) : (
        <WarbandDesktopHeader
          {...header}
          activeTab={page.activeTab}
          onTabChange={page.handleTabChange}
          stash={stash}
          campaignId={campaignId}
          userId={user?.id}
          onCreateTradeRequest={trade.handleTradeRequestCreated}
        />
      )}
      <TradeSessionDialog
        session={tradeSession}
        tradeRequest={trade.tradeRequest}
        heroes={heroes}
        warbandId={warband.id}
        warchestItems={warchest.warchestItems}
        isWarchestLoading={warchest.isWarchestLoading}
        warchestError={warchest.warchestError}
        availableGold={tradeTotal}
        onRequestUpdated={trade.setTradeRequest}
        onClose={trade.handleTradeSessionClose}
      />
      <TabbedCard
        tabs={WARBAND_TABS}
        activeTab={page.activeTab}
        onTabChange={page.handleTabChange}
        mobileTabsShowDivider
        tabsClassName={isMobile ? undefined : "hidden"}
        className="pb-6"
        contentClassName={isMobile ? "space-y-4 pt-2" : "pt-0"}
      >
        {page.activeTab === "warband" ? (
          <WarbandCatalogueProvider campaignId={campaignId} canAddCustom={access.canAddCustom}>
            <WarbandTabContent
              warbandId={warband.id}
              resources={warband.resources ?? []}
              onResourcesUpdated={(resources) => mergeWarband({ resources })}
              canEdit={canEdit}
              editors={page.editors}
              {...roster}
              levelThresholds={page.levelThresholds}
              availableGold={tradeTotal}
              layoutVariant={isMobile ? "mobile" : "default"}
              sectionActionsHidden={page.sectionActionsHidden}
              showLoadoutOnMobile={warband.show_loadout_on_mobile ?? false}
            />
          </WarbandCatalogueProvider>
        ) : page.activeTab === "treasury" ? (
          <TradesTab
            warband={warband}
            canEdit={canEdit}
            isMobile={isMobile}
            onTradeCreated={(t) => setTradeTotal((prev) => prev + getSignedTradePrice(t))}
          />
        ) : page.activeTab === "backstory" ? (
          <BackstoryTab
            warband={warband}
            isWarbandOwner={isWarbandOwner}
            isMobile={isMobile}
            onWarbandUpdated={mergeWarband}
          />
        ) : (
          <LogsTab warband={warband} />
        )}
      </TabbedCard>
    </div>
  );
}
