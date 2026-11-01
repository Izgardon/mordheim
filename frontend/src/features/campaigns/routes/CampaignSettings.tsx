import { useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { campaignCapabilities, isArchived, type CampaignCapabilities } from "../capabilities";
import ArchiveSection from "../components/settings/ArchiveSection";
import BattlesSection from "../components/settings/BattlesSection";
import CampaignSection from "../components/settings/CampaignSection";
import FeedbackReportCard from "../components/settings/FeedbackReportCard";
import JoinCode from "../components/settings/JoinCode";
import PlayersSection from "../components/settings/PlayersSection";
import WarbandSection from "../components/settings/WarbandSection";
import type { CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

type SectionId = "campaign" | "players" | "battles" | "warband" | "archive" | "feedback";

type Section = {
  id: SectionId;
  label: string;
  shown: (capabilities: CampaignCapabilities, campaign: CampaignSummary) => boolean;
};

/** The sections in order; each shows only to those today's capabilities let use it. */
const SECTIONS: Section[] = [
  {
    id: "campaign",
    label: "Campaign",
    shown: (caps) => caps.edit_settings,
  },
  {
    id: "players",
    label: "Players",
    shown: (caps) => caps.view_members,
  },
  {
    id: "battles",
    label: "Battles",
    shown: (caps) => caps.manage_battles,
  },
  {
    id: "warband",
    label: "Your warband",
    shown: () => true,
  },
  {
    id: "archive",
    label: "Archive",
    shown: (caps) => caps.archive || caps.restore || caps.delete,
  },
  {
    id: "feedback",
    label: "Feedback",
    shown: () => true,
  },
];

/** Old links (`?tab=campaign&section=active-battles`) and anything unknown land somewhere real. */
function sectionFromUrl(params: URLSearchParams, available: Section[]): SectionId | null {
  const raw = params.get("section");
  const asked = raw === "active-battles" ? "battles" : raw;
  return available.find((section) => section.id === asked)?.id ?? null;
}

function SectionBody({ id, campaign }: { id: SectionId; campaign: CampaignSummary }) {
  const capabilities = campaignCapabilities(campaign);
  const { warband } = useAppStore();
  switch (id) {
    case "campaign":
      return <CampaignSection campaign={campaign} />;
    case "players":
      return <PlayersSection campaign={campaign} />;
    case "battles":
      return <BattlesSection campaignId={campaign.id} />;
    case "warband":
      return <WarbandSection campaign={campaign} />;
    case "archive":
      return <ArchiveSection campaign={campaign} capabilities={capabilities} />;
    case "feedback":
      return (
        <FeedbackReportCard
          campaignId={campaign.id}
          campaignName={campaign.name}
          warbandId={warband?.campaign_id === campaign.id ? warband.id : undefined}
          warbandName={warband?.campaign_id === campaign.id ? warband.name : undefined}
        />
      );
  }
}

/**
 * Campaign settings (design E, built from its primitives): every section today's settings
 * page had, on one page. On the web a section list sits beside the open section; on a phone the
 * list opens each section on its own, with a way back. The open section lives in `?section=`, so
 * the overview's stuck-battles Review and the archived banner link straight to theirs.
 */
export default function CampaignSettings() {
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [params, setParams] = useSearchParams();
  const capabilities = campaignCapabilities(campaign);
  const available = campaign
    ? SECTIONS.filter((section) => section.shown(capabilities, campaign))
    : [];
  const asked = sectionFromUrl(params, available);
  // The web always shows a section; a phone shows the list until one is picked.
  const current = asked ?? (isMobile ? null : (available[0]?.id ?? null));

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [current]);

  if (!campaign)
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;

  const open = (id: SectionId | null) =>
    setParams(id ? { section: id } : {}, { replace: !isMobile });
  const players = `${campaign.player_count} ${campaign.player_count === 1 ? "player" : "players"}`;
  const kicker = `${campaign.name} · ${players}${isArchived(campaign) ? " · archived" : ""}`;
  const joinCode = (
    <JoinCode campaign={campaign} canRegenerate={capabilities.regenerate_join_code} />
  );

  if (isMobile) {
    if (!current) {
      return (
        <div className="flex flex-col gap-4 pb-6 pt-3">
          <div className="border border-border bg-surface p-4">{joinCode}</div>
          <nav aria-label="Settings sections" className="border border-border bg-surface">
            <ul className="m-0 list-none p-0">
              {available.map((section) => (
                <li key={section.id} className="border-t border-line first:border-t-0">
                  <button
                    type="button"
                    onClick={() => open(section.id)}
                    className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left"
                  >
                    <span className="min-w-0 flex-1 text-[15px] font-bold text-head">
                      {section.label}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      );
    }
    const section = available.find((entry) => entry.id === current);
    return (
      <div className="flex flex-col gap-3 pb-6">
        <button
          type="button"
          onClick={() => open(null)}
          className="flex min-h-11 items-center gap-1 self-start text-sm font-bold text-accent-text"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          All settings
        </button>
        {/* The cards name what they hold; the heading is for screen readers. */}
        <h1 className="sr-only">{section?.label}</h1>
        <SectionBody id={current} campaign={campaign} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 pb-14">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            {kicker}
          </span>
          <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head">
            Settings
          </h1>
        </div>
        {joinCode}
      </header>
      <div className="flex items-start gap-8">
        <nav aria-label="Settings sections" className="sticky top-6 w-[220px] shrink-0">
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {available.map((section) => {
              const selected = section.id === current;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    aria-current={selected ? "page" : undefined}
                    onClick={() => open(section.id)}
                    className={cn(
                      "flex min-h-10 w-full items-center border-l-2 px-3 text-left text-sm font-bold transition-colors",
                      selected
                        ? "border-primary bg-accent-soft text-head"
                        : "border-transparent text-text2 hover:bg-raised hover:text-head"
                    )}
                  >
                    {section.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {current ? <SectionBody id={current} campaign={campaign} /> : null}
        </div>
      </div>
    </div>
  );
}
