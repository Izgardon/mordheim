import { useState, type ReactNode } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { GameIcon } from "@/components/ui/game-icons";
import { SectionHead } from "@/components/ui/section-title";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useYourOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import OpenBounties from "@/features/bounties/components/OpenBounties";
import CampaignRulesSection from "@/features/rules/components/CampaignRulesSection";
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
import type { CampaignChronicleEntry } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

const TABS = [
  { id: "standings", label: "Standings" },
  { id: "chronicle", label: "Chronicle" },
  { id: "battles", label: "Battles" },
  { id: "bounties", label: "Bounties" },
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
      <SectionHead title={title} aside={aside} />
      {children}
    </section>
  );
}

/**
 * The campaign overview (design E): who is ready (in the web bar), Start battle and Report a
 * result, the stats, the standings, the latest battles with their moments, the chronicle, the
 * open bounties and the campaign rules; what waits on you (stuck battles, results to answer) above
 * them. While you have a battle, Start battle takes you there. On a phone the sections are tabs,
 * Standings first, with the campaign rules under them.
 */
export default function Overview() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign, openBattleDialog } = useOutletContext<CampaignLayoutContext>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const playersQuery = useCampaignPlayers(campaignId);
  const historyQuery = useCampaignBattleHistory(campaignId);
  const yourBattle = useYourOpenBattles(campaignId).battles[0] ?? null;
  const players = playersQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const [tab, setTab] = useState<Tab>("standings");
  if (!campaign)
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  if (playersQuery.isLoading || historyQuery.isLoading) return <OverviewSkeleton />;

  const standings = buildStandings(players, history);
  const capabilities = campaignCapabilities(campaign);
  const rules = (
    <CampaignRulesSection campaignId={campaignId} canManage={capabilities.manage_campaign_rules} />
  );
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
  const stats = (
    <dl
      className={cn(
        "m-0 border-y border-line",
        // a phone's four sit apart as wide as their labels, so a long one (Wyrdstone) never runs on
        isMobile
          ? "flex justify-between gap-x-3"
          : "grid [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]"
      )}
    >
      {buildStats(players, history, campaign.default_resource_name)
        .filter((stat) => !isMobile || stat.short)
        .map((stat) => (
          <div
            key={stat.k}
            className={cn("flex min-w-0 flex-col gap-0.5", isMobile ? "py-2.5" : "py-3.5 pr-4")}
          >
            <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint max-[960px]:text-[10px] max-[960px]:tracking-[0.1em]">
              <GameIcon name={stat.icon} className="h-3.5 w-3.5 shrink-0 text-accent-text" />
              <span className="truncate">{isMobile ? stat.short : stat.k}</span>
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
      {/* the web's is in the bar (CampaignLayout) */}
      {isMobile ? <ReadinessBar players={players} userId={user?.id} isMobile /> : null}
      <OverviewHeader
        campaign={campaign}
        isMobile={isMobile}
        battle={yourBattle}
        onStartBattle={() => openBattleDialog("start_battle")}
        onReportResult={() => openBattleDialog("report_result")}
        onExport={onExport}
      />
      <OverviewNotices campaignId={campaignId} managesBattles={capabilities.manage_battles} />
      {stats}
      {isMobile ? (
        <>
          <div
            role="tablist"
            aria-label="Campaign"
            className="grid grid-cols-4 border-b border-line"
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
          {tab === "bounties" ? (
            <OpenBounties campaignId={campaignId} isMobile heading={false} />
          ) : null}
          {tab === "battles" ? (
            <>
              {recent}
              {allLink}
            </>
          ) : null}
          {rules}
        </>
      ) : (
        <div className={OVERVIEW_BODY}>
          <div className={OVERVIEW_MAIN}>
            <Section title="Standings">{standingsTable}</Section>
            <Section title="Battles" aside={allLink} className={OVERVIEW_DIVIDED}>
              {recent}
            </Section>
          </div>
          <aside className={OVERVIEW_ASIDE}>
            {/* the chronicle scrolls inside its own box, so the bounties under it stay in reach */}
            <Chronicle campaignId={campaignId} isMobile={false} />
            <OpenBounties campaignId={campaignId} isMobile={false} />
            {rules}
          </aside>
        </div>
      )}
    </div>
  );
}
