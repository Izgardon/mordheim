import { useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/hooks/use-auth";
import type { StoreOpening } from "@/features/items/store/StorePanel";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { useMediaQuery } from "@/lib/use-media-query";

import { warbandStashQuery } from "../api/economy-queries";
import CreateWarband from "../components/page/CreateWarband";
import { BackstoryTab, LogTab } from "../components/page/StoryAndLogTabs";
import TreasuryTab from "../components/page/TreasuryTab";
import WarbandHeader, { type WarbandPanel } from "../components/page/WarbandHeader";
import WarbandResources from "../components/page/WarbandResources";
import WarbandStats from "../components/page/WarbandStats";
import WarbandPanels, { storeFor } from "../components/page/WarbandPanels";
import WarbandSkeleton from "../components/page/WarbandSkeleton";
import WarbandTabs from "../components/page/WarbandTabs";
import { WARBAND_INFO } from "../components/page/warband-layout";
import PostgameSlot from "../components/camp/PostgameSlot";
import AdvanceDialog from "../components/roster/AdvanceDialog";
import EditUnitForm from "../components/roster/EditUnitForm";
import RecruitDialog from "../components/roster/RecruitDialog";
import RosterSections from "../components/roster/RosterSections";
import WarbandTrade from "../components/trade/WarbandTrade";
import type { RosterUnit } from "../components/roster/unit-view";
import { useUnitActions } from "../hooks/units/useUnitActions";
import { useWarbandSheet } from "../hooks/warband/useWarbandSheet";
import type { UnitKindKey } from "../types/units";

/** The warband page (design E): your own warband, or someone else's to look at. */
export default function Warband() {
  const { id, warbandId: warbandParam } = useParams();
  const campaignId = Number(id);
  const navigate = useNavigate();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sheet = useWarbandSheet({
    campaignId,
    hasCampaignId: Boolean(id),
    warbandId: warbandParam ? Number(warbandParam) : null,
  });
  const { warband, capabilities } = sheet;
  const isMobile = useMediaQuery("(max-width: 960px)");
  const panel = searchParams.get("panel") as WarbandPanel | null;
  const [loadoutFor, setLoadoutFor] = useState<RosterUnit | null>(null);
  const [recruiting, setRecruiting] = useState<UnitKindKey | null>(null);
  const [advancing, setAdvancing] = useState<RosterUnit | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [tradeInviteOpen, setTradeInviteOpen] = useState(false);
  const [store, setStore] = useState<StoreOpening>({});
  const warbandId = warband?.id ?? 0;
  const actions = useUnitActions(warbandId);
  const stash = useQuery({
    ...warbandStashQuery(campaignId, warbandId),
    enabled: Boolean(warband),
  });
  const stashCount = (stash.data ?? []).reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const setPanel = (next: WarbandPanel | null) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("panel", next);
    else params.delete("panel");
    setSearchParams(params, { replace: true });
  };
  const openStore = (opening: StoreOpening) => {
    setStore(opening);
    setPanel("store");
  };

  if (sheet.isLoading) return <WarbandSkeleton />;
  if (sheet.error) return <p className="text-sm text-danger">{sheet.error}</p>;
  if (!warband) {
    return warbandParam ? (
      <p className="text-sm text-text2">No record of that warband.</p>
    ) : (
      <CreateWarband campaignId={campaignId} onCreated={sheet.showCreated} />
    );
  }

  const canEdit = capabilities.edit;
  const mine = warband.user_id === user?.id;
  const units: RosterUnit[] = [
    ...sheet.heroes.map((unit) => ({ kind: "hero" as const, unit })),
    ...sheet.henchmenGroups.map((unit) => ({ kind: "henchmen_group" as const, unit })),
    ...sheet.hirelings.map((unit) => ({ kind: "hireling" as const, unit })),
  ];
  const postgame = {
    campaignId,
    campaign,
    warbandId,
    userId: user?.id,
    enabled: mine && canEdit,
    isMobile,
    onHire: () => setRecruiting("hireling"),
    onStore: () => openStore({}),
  } as const;

  return (
    <div className="flex flex-col gap-6">
      <PostgameSlot slot={isMobile ? "aside" : "bar"} {...postgame} />
      <WarbandHeader
        kicker={[warband.warband_type?.name, mine ? user?.name : null].filter(Boolean).join(" · ")}
        name={warband.name}
        stashCount={stashCount}
        showLocations={Boolean(campaign?.enable_locations)}
        onOpen={(next) => (next === "store" ? openStore({}) : setPanel(next))}
        menu={[
          ...(capabilities.trade
            ? [{ label: "Trade with a player", onSelect: () => setTradeInviteOpen(true) }]
            : []),
          ...(warband.warband_link ? [{ label: "Warband sheet", href: warband.warband_link }] : []),
          { label: "Rating breakdown", onSelect: () => setBreakdownOpen(true) },
        ]}
      />
      {capabilities.trade ? (
        <WarbandTrade
          campaignId={campaignId}
          warbandId={warbandId}
          heroes={sheet.heroes}
          gold={warband.gold ?? 0}
          inviteOpen={tradeInviteOpen}
          onInviteOpenChange={setTradeInviteOpen}
        />
      ) : null}
      <div className={WARBAND_INFO}>
        <WarbandStats
          warband={warband}
          heroes={sheet.heroes}
          hirelings={sheet.hirelings}
          henchmenGroups={sheet.henchmenGroups}
          breakdownOpen={breakdownOpen}
          setBreakdownOpen={setBreakdownOpen}
        />
        <WarbandResources
          warbandId={warbandId}
          resources={warband.resources ?? []}
          canEdit={canEdit}
        />
      </div>
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <WarbandTabs
            render={(tab) =>
              tab === "Roster" ? (
                <RosterSections
                  warbandId={warbandId}
                  campaign={campaign}
                  heroes={sheet.heroes}
                  henchmenGroups={sheet.henchmenGroups}
                  hirelings={sheet.hirelings}
                  canEdit={canEdit}
                  onLoadout={setLoadoutFor}
                  onRecruit={(kind) =>
                    // hired swords come from the hire picker (the catalogue), which has the custom hire too
                    kind === "hireling"
                      ? navigate(`/campaigns/${campaignId}/hired-swords?warband=${warbandId}`)
                      : setRecruiting(kind)
                  }
                  onAdvance={setAdvancing}
                  onBuyAgain={(entry, item) =>
                    openStore(
                      storeFor(entry, {
                        itemId: item.id,
                        name: item.name,
                        price: item.current_price ?? null,
                      })
                    )
                  }
                  renderEdit={(entry, close) => (
                    <EditUnitForm
                      entry={entry}
                      campaignId={campaignId}
                      warbandId={warbandId}
                      canCreateRace={capabilities.edit_catalogue}
                      onAddItem={() => setLoadoutFor(entry)}
                      onClose={close}
                    />
                  )}
                />
              ) : tab === "Treasury" ? (
                <TreasuryTab campaignId={campaignId} warbandId={warbandId} canEdit={canEdit} />
              ) : tab === "Backstory" ? (
                <BackstoryTab
                  warband={warband}
                  canEdit={capabilities.edit_backstory}
                  onWarbandUpdated={sheet.mergeWarband}
                />
              ) : (
                <LogTab campaignId={campaignId} warbandId={warbandId} />
              )
            }
          />
        </div>
        {isMobile ? null : <PostgameSlot slot="aside" {...postgame} />}
      </div>

      <WarbandPanels
        campaignId={campaignId}
        warband={warband}
        heroes={sheet.heroes}
        henchmenGroups={sheet.henchmenGroups}
        hirelings={sheet.hirelings}
        units={units}
        canEdit={canEdit}
        canManageItems={capabilities.manage_items}
        panel={panel}
        setPanel={setPanel}
        loadoutFor={loadoutFor}
        setLoadoutFor={setLoadoutFor}
        store={store}
        openStore={openStore}
        actions={actions}
        placeSearch={searchParams.get("place") ?? undefined}
      />
      <RecruitDialog kind={recruiting} warbandId={warbandId} onClose={() => setRecruiting(null)} />
      <AdvanceDialog
        entry={advancing}
        warbandId={warbandId}
        heroes={sheet.heroes}
        maxHeroes={campaign?.max_heroes ?? null}
        onClose={() => setAdvancing(null)}
      />
    </div>
  );
}
