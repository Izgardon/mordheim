import { useCallback, useMemo } from "react";
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
import DiscardChangesDialog from "../components/warband/DiscardChangesDialog";
import { WarbandCatalogueProvider } from "../components/units/catalogue-context";
import { ShownWarbandProvider } from "../components/warband/shown-warband-context";
import { useAuth } from "../../auth/hooks/use-auth";
import { useWarbandSheet } from "../hooks/warband/useWarbandSheet";
import { useWarbandWarchest } from "../hooks/warband/useWarbandWarchest";
import { useWarbandTradeSession } from "../hooks/warband/useWarbandTradeSession";
import { WARBAND_TABS, useWarbandPage } from "../hooks/warband/useWarbandPage";
import { useAppStore } from "@/stores/app-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { createWarband } from "../api/warbands-api";
import { calculateWarbandRating } from "../utils/warband-utils";

import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";
import type { WarbandCreatePayload, WarbandHero } from "../types/warband-types";

export default function Warband() {
  const { id, warbandId } = useParams();
  const { campaign, setMobileTopBar, showRejoinBattleButton } =
    useOutletContext<CampaignLayoutContext>();
  const { tradeSession } = useAppStore();
  const isMobile = useMediaQuery("(max-width: 960px)");

  const campaignId = useMemo(() => Number(id), [id]);
  const resolvedWarbandId = useMemo(() => (warbandId ? Number(warbandId) : null), [warbandId]);
  const hasCampaignId = Boolean(id);
  const isViewingOtherWarband = resolvedWarbandId !== null;

  const sheet = useWarbandSheet({ campaignId, hasCampaignId, warbandId: resolvedWarbandId });
  const { warband, heroes, hiredSwords, henchmenGroups, setUnits, mergeWarband } = sheet;
  const { capabilities } = sheet;
  const canEdit = capabilities.edit;
  const { user } = useAuth();

  const page = useWarbandPage({
    campaign,
    warband,
    roster: { hero: heroes, henchmen_group: henchmenGroups, hired_sword: hiredSwords },
    setUnits,
    onWarbandSaved: mergeWarband,
    canEdit,
    isMobile,
    isLoadingWarband: sheet.isLoading,
    setMobileTopBar,
    hasRejoinButton: showRejoinBattleButton,
  });

  const warchest = useWarbandWarchest(campaignId, warband?.id);
  const trade = useWarbandTradeSession({
    campaignId,
    hasCampaignId,
    warbandId: warband?.id,
    loadWarchestItems: warchest.loadWarchestItems,
  });

  const roster = { heroes, hiredSwords, henchmenGroups };
  const replaceHero = useCallback(
    (updated: WarbandHero) =>
      setUnits.hero((prev) => prev.map((hero) => (hero.id === updated.id ? updated : hero))),
    [setUnits]
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
    await sheet.showCreated(await createWarband(campaignId, payload));
  };

  if (sheet.isLoading || sheet.error || !warband) {
    return (
      <WarbandPageStatus
        isLoading={sheet.isLoading}
        error={sheet.error}
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
  // Gold is the server's, from the sheet's summary (BUG-37); nothing on the page adds to it.
  const gold = warband.gold ?? 0;
  const header = {
    warband,
    warbandRating,
    ...roster,
    canManageItems: capabilities.manage_items,
    canInitiateTrade,
    pendingGold: page.pendingGold,
  };
  // Item actions on this page (buy, give, move) act on the warband shown here (BUG-107).
  return (
    <ShownWarbandProvider campaignId={campaignId} warbandId={warband.id}>
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
        <DiscardChangesDialog {...page.discardDialog} />
        <TradeSessionDialog
          session={tradeSession}
          tradeRequest={trade.tradeRequest}
          heroes={heroes}
          warchestItems={warchest.warchestItems}
          isWarchestLoading={warchest.isWarchestLoading}
          warchestError={warchest.warchestError}
          availableGold={gold}
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
            <WarbandCatalogueProvider
              campaignId={campaignId}
              canAddCustom={capabilities.add_custom}
            >
              <WarbandTabContent
                warbandId={warband.id}
                resources={warband.resources ?? []}
                onResourcesUpdated={(resources) => mergeWarband({ resources })}
                capabilities={capabilities}
                editors={page.editors}
                {...roster}
                levelThresholds={page.levelThresholds}
                availableGold={gold}
                layoutVariant={isMobile ? "mobile" : "default"}
                sectionActionsHidden={page.sectionActionsHidden}
                sizeWarning={page.sizeWarning}
                showLoadoutOnMobile={warband.show_loadout_on_mobile ?? false}
              />
            </WarbandCatalogueProvider>
          ) : page.activeTab === "treasury" ? (
            <TradesTab warband={warband} canEdit={canEdit} isMobile={isMobile} />
          ) : page.activeTab === "backstory" ? (
            <BackstoryTab
              warband={warband}
              canEdit={capabilities.edit_backstory}
              canEditRoster={capabilities.edit}
              isMobile={isMobile}
              onWarbandUpdated={mergeWarband}
            />
          ) : (
            <LogsTab warband={warband} />
          )}
        </TabbedCard>
      </div>
    </ShownWarbandProvider>
  );
}
