import { useState } from "react";
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/hooks/use-auth";
import type { StoreOpening } from "@/features/items/store/StorePanel";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { useMediaQuery } from "@/lib/use-media-query";

import { warbandStashQuery } from "../api/economy-queries";
import CreateWarband from "../components/page/CreateWarband";
import WarbandHeader, { type WarbandPanel } from "../components/page/WarbandHeader";
import WarbandPanels, { storeFor } from "../components/page/WarbandPanels";
import WarbandSections from "../components/page/WarbandSections";
import WarbandSkeleton from "../components/page/WarbandSkeleton";
import PostgameSlot from "../components/camp/PostgameSlot";
import LocationsPanel from "../components/panels/LocationsPanel";
import AdvanceDialog from "../components/roster/AdvanceDialog";
import WarbandTrade from "../components/trade/WarbandTrade";
import type { RosterUnit } from "../components/roster/unit-view";
import { useUnitActions } from "../hooks/units/useUnitActions";
import { useWarbandSheet } from "../hooks/warband/useWarbandSheet";

/** The warband page (design E): your own warband, or someone else's to look at. */
export default function Warband() {
  const { id, warbandId: warbandParam } = useParams();
  const campaignId = Number(id);
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
      <>
        <CreateWarband
          campaignId={campaignId}
          onCreated={sheet.showCreated}
          showPlot={Boolean(campaign?.enable_campaign_points)}
        />
        {/* Search everything's locations open here too: the list needs no warband */}
        <LocationsPanel
          campaignId={campaignId}
          warbandId={0}
          heroes={[]}
          canEdit={false}
          open={panel === "locations"}
          onOpenChange={(next) => setPanel(next ? "locations" : null)}
        />
      </>
    );
  }

  const canEdit = capabilities.edit;
  const mine = warband.user_id === user?.id;
  const units: RosterUnit[] = [
    ...sheet.heroes.map((unit) => ({ kind: "hero" as const, unit })),
    ...sheet.henchmenGroups.map((unit) => ({ kind: "henchmen_group" as const, unit })),
    ...sheet.hirelings.map((unit) => ({ kind: "hireling" as const, unit })),
  ];
  // the hire drawer (William, 7 Nov 2026: "should open a side draw")
  const hire = () => setPanel("hire");
  const postgame = {
    campaignId,
    campaign,
    warbandId,
    userId: user?.id,
    enabled: mine && canEdit,
    isMobile,
    onHire: hire,
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
        showEncampment={isMobile && Boolean(campaign?.enable_encampments)}
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
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <WarbandSections
            campaignId={campaignId}
            campaign={campaign}
            warband={warband}
            sheet={sheet}
            canEdit={canEdit}
            breakdownOpen={breakdownOpen}
            setBreakdownOpen={setBreakdownOpen}
            onLoadout={setLoadoutFor}
            onHire={hire}
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
          />
        </div>
        {isMobile ? null : <PostgameSlot slot="aside" {...postgame} />}
      </div>

      <WarbandPanels
        campaignId={campaignId}
        warband={warband}
        heroes={sheet.heroes}
        henchmenGroups={sheet.henchmenGroups}
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
      <AdvanceDialog
        entry={advancing}
        campaignId={campaignId}
        warbandId={warbandId}
        heroes={sheet.heroes}
        maxHeroes={campaign?.max_heroes ?? null}
        onClose={() => setAdvancing(null)}
      />
    </div>
  );
}
