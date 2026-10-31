import { useState, type ReactNode } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useRefreshOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import { invalidatePendingResults } from "@/features/battles/hooks/usePendingReportedResults";
import { useMediaQuery } from "@/lib/use-media-query";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

import { useCampaignBattleHistory, useCampaignPlayers } from "../api/campaign-queries";
import { campaignCapabilities } from "../capabilities";
import BattleRows from "../components/overview/BattleRows";
import Chronicle from "../components/overview/Chronicle";
import { exportCampaign } from "../components/overview/export-campaign";
import { buildStandings, buildStats } from "../components/overview/overview-data";
import OverviewHeader from "../components/overview/OverviewHeader";
import OverviewNotices from "../components/overview/OverviewNotices";
import OverviewSkeleton from "../components/overview/OverviewSkeleton";
import {
  OVERVIEW_ASIDE,
  OVERVIEW_BODY,
  OVERVIEW_DIVIDED,
  OVERVIEW_MAIN,
} from "../components/overview/overview-layout";
import ReadinessBar from "../components/overview/ReadinessBar";
import StandingsTable from "../components/overview/StandingsTable";
import StartBattleDialog from "../components/overview/StartBattleDialog";
import type { BattleDialogMode } from "../hooks/overview/useStartBattleForm";
import type { CampaignChronicleEntry } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

const TABS = [
  { id: "standings", label: "Standings" },
  { id: "chronicle", label: "Chronicle" },
  { id: "battles", label: "Battles" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const RECENT = 5;

function Section({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 font-display text-[22px] font-semibold text-head">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * The campaign overview (design E): who is ready, Start battle and Report a result, the stats,
 * the standings, the latest battles with their moments, and the chronicle; what waits on you
 * (an unfinished battle, stuck battles, results to answer) above them. On a phone the sections
 * are tabs, Standings first. Open bounties are left out: there are none in the backend yet.
 */
export default function Overview() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const refreshOpenBattles = useRefreshOpenBattles(campaignId);
  const playersQuery = useCampaignPlayers(campaignId);
  const historyQuery = useCampaignBattleHistory(campaignId);
  const players = playersQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const [dialog, setDialog] = useState<BattleDialogMode | null>(null);
  const [tab, setTab] = useState<Tab>("standings");
  if (!campaign)
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  if (playersQuery.isLoading || historyQuery.isLoading) return <OverviewSkeleton />;

  const standings = buildStandings(players, history);
  const battlesHref = `/campaigns/${campaignId}/battles`;
  const standingsTable = (
    <StandingsTable
      rows={standings}
      campaignId={campaignId}
      userId={user?.id}
      isMobile={isMobile}
    />
  );
  const recent = (
    <BattleRows battles={history.slice(0, RECENT)} campaignId={campaignId} isMobile={isMobile} />
  );
  const allLink =
    history.length > RECENT ? (
      <Link to={battlesHref} className="text-[13px] font-semibold text-accent-text">
        All {history.length}
      </Link>
    ) : null;
  const onExport = () =>
    exportCampaign(
      campaign,
      standings,
      history,
      queryClient.getQueryData<CampaignChronicleEntry[]>(
        queryKeys.campaign.chronicle(campaignId, "all")
      ) ?? []
    );
  const created = () => {
    void refreshOpenBattles();
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.players(campaignId) });
    void invalidatePendingResults(queryClient, campaignId);
  };
  const stats = (
    <dl
      className={cn(
        "m-0 grid border-y border-line",
        isMobile ? "grid-cols-4" : "[grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]"
      )}
    >
      {buildStats(players, history)
        .filter((stat) => !isMobile || stat.short)
        .map((stat) => (
          <div
            key={stat.k}
            className={cn("flex flex-col gap-0.5", isMobile ? "py-2.5" : "py-3.5 pr-4")}
          >
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint max-[960px]:text-[10px] max-[960px]:tracking-[0.1em]">
              {isMobile ? stat.short : stat.k}
            </dt>
            <dd
              className={cn(
                "m-0 font-display font-semibold text-head",
                isMobile ? "text-xl" : "text-[26px]"
              )}
            >
              {stat.v}
            </dd>
          </div>
        ))}
    </dl>
  );

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-3 pb-6" : "gap-[26px] pb-14")}>
      <ReadinessBar players={players} userId={user?.id} isMobile={isMobile} />
      <OverviewHeader
        campaign={campaign}
        isMobile={isMobile}
        onStartBattle={() => setDialog("start_battle")}
        onReportResult={() => setDialog("report_result")}
        onExport={onExport}
      />
      <OverviewNotices
        campaignId={campaignId}
        managesBattles={campaignCapabilities(campaign).manage_battles}
      />
      {stats}
      {isMobile ? (
        <>
          <div
            role="tablist"
            aria-label="Campaign"
            className="grid grid-cols-3 border-b border-line"
          >
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={cn(
                  "-mb-px min-h-11 border-b-2 text-[13px] font-bold",
                  tab === entry.id
                    ? "border-primary text-head"
                    : "border-transparent text-muted-foreground"
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {tab === "standings" ? standingsTable : null}
          {tab === "chronicle" ? (
            <Chronicle campaignId={campaignId} isMobile heading={false} />
          ) : null}
          {tab === "battles" ? (
            <>
              {recent}
              {allLink}
            </>
          ) : null}
        </>
      ) : (
        <div className={OVERVIEW_BODY}>
          <div className={OVERVIEW_MAIN}>
            <Section
              title="Standings"
              aside={<span className="text-[13px] text-faint">By warband rating</span>}
            >
              {standingsTable}
            </Section>
            <Section title="Battles" aside={allLink} className={OVERVIEW_DIVIDED}>
              {recent}
            </Section>
          </div>
          <aside className={OVERVIEW_ASIDE}>
            <Chronicle campaignId={campaignId} isMobile={false} />
          </aside>
        </div>
      )}
      {user ? (
        <StartBattleDialog
          mode={dialog}
          onClose={() => setDialog(null)}
          campaignId={campaignId}
          userId={user.id}
          players={players}
          onCreated={created}
        />
      ) : null}
    </div>
  );
}
