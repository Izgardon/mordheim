import { useState } from "react";
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { SidePanel } from "@/components/ui/side-panel";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { cn } from "@/lib/utils";

import { warbandStashQuery } from "../api/economy-queries";
import CreateWarband from "../components/page/CreateWarband";
import { BackstoryTab, LogTab } from "../components/page/StoryAndLogTabs";
import TreasuryTab from "../components/page/TreasuryTab";
import WarbandHeader, { type WarbandPanel } from "../components/page/WarbandHeader";
import WarbandResources from "../components/page/WarbandResources";
import WarbandStats from "../components/page/WarbandStats";
import LoadoutPanel from "../components/panels/LoadoutPanel";
import LocationsPanel from "../components/panels/LocationsPanel";
import StashPanel from "../components/panels/StashPanel";
import AdvanceDialog from "../components/roster/AdvanceDialog";
import EditUnitForm from "../components/roster/EditUnitForm";
import RecruitDialog from "../components/roster/RecruitDialog";
import RosterSections from "../components/roster/RosterSections";
import WarbandTrade from "../components/trade/WarbandTrade";
import type { RosterUnit } from "../components/roster/unit-view";
import { useUnitActions } from "../hooks/units/useUnitActions";
import { useWarbandSheet } from "../hooks/warband/useWarbandSheet";
import type { UnitKindKey } from "../types/units";

const TABS = ["Roster", "Treasury", "Backstory", "Log"] as const;
type Tab = (typeof TABS)[number];

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
  const [tab, setTab] = useState<Tab>("Roster");
  const panel = searchParams.get("panel") as WarbandPanel | null;
  const [loadoutFor, setLoadoutFor] = useState<RosterUnit | null>(null);
  const [recruiting, setRecruiting] = useState<UnitKindKey | null>(null);
  const [advancing, setAdvancing] = useState<RosterUnit | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [tradeInviteOpen, setTradeInviteOpen] = useState(false);
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

  if (sheet.isLoading)
    return <p className="text-sm text-muted-foreground">Mustering the warband…</p>;
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
  const sellFromStash = (item: { id: number; suggested_sale_price?: number | null }) =>
    actions.sellItem(null, item.id, item.suggested_sale_price ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <WarbandHeader
        kicker={[warband.faction, mine ? user?.name : null].filter(Boolean).join(" · ")}
        name={warband.name}
        stashCount={stashCount}
        showLocations={Boolean(campaign?.enable_locations)}
        onOpen={setPanel}
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
      <div className="grid gap-x-8 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
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
      <div role="tablist" aria-label="Warband" className="flex gap-7 border-b border-line">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cn(
              "-mb-px border-b-2 py-2.5 text-sm font-semibold",
              tab === name
                ? "border-primary text-head"
                : "border-transparent text-faint hover:text-text2"
            )}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === "Roster" ? (
        <RosterSections
          warbandId={warbandId}
          campaign={campaign}
          heroes={sheet.heroes}
          henchmenGroups={sheet.henchmenGroups}
          hirelings={sheet.hirelings}
          canEdit={canEdit}
          onLoadout={setLoadoutFor}
          onRecruit={setRecruiting}
          onAdvance={setAdvancing}
          renderEdit={(entry, close) => (
            <EditUnitForm
              entry={entry}
              campaignId={campaignId}
              warbandId={warbandId}
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
      )}

      <LoadoutPanel
        campaignId={campaignId}
        warbandId={warbandId}
        entry={
          loadoutFor
            ? (units.find((u) => u.kind === loadoutFor.kind && u.unit.id === loadoutFor.unit.id) ??
              null)
            : null
        }
        onOpenChange={(open) => (open ? null : setLoadoutFor(null))}
        canEdit={capabilities.manage_items}
        units={units}
        onMove={actions.moveItem}
        onSellFromStash={sellFromStash}
        onOpenStore={() => {
          setLoadoutFor(null);
          setPanel("store");
        }}
      />
      <StashPanel
        campaignId={campaignId}
        warbandId={warbandId}
        open={panel === "stash"}
        onOpenChange={(open) => setPanel(open ? "stash" : null)}
        canEdit={capabilities.manage_items}
        units={units}
        onMove={(itemId, to) => actions.moveItem(null, itemId, to)}
        onSell={sellFromStash}
      />
      <SidePanel
        open={panel === "store"}
        onOpenChange={(open) => setPanel(open ? "store" : null)}
        kicker="Warband"
        title="Store"
      >
        <p className="text-sm text-text2">Rebuilding in step 4.</p>
      </SidePanel>
      <LocationsPanel
        campaignId={campaignId}
        warbandId={warbandId}
        heroes={sheet.heroes}
        canEdit={canEdit}
        open={panel === "locations"}
        onOpenChange={(open) => setPanel(open ? "locations" : null)}
      />
      <RecruitDialog kind={recruiting} warbandId={warbandId} onClose={() => setRecruiting(null)} />
      <AdvanceDialog entry={advancing} warbandId={warbandId} onClose={() => setAdvancing(null)} />
    </div>
  );
}
