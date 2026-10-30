import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import { usePostgameDraft } from "@/features/battles/hooks/usePostgameDraft";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import LocationsPanel from "@/features/warbands/components/panels/LocationsPanel";
import { cn } from "@/lib/utils";

import AftermathAside, { opponentsOf, resultText } from "./AftermathAside";
import AftermathHeader, { AFTERMATH_TABS, type AftermathTab } from "./AftermathHeader";
import AftermathMenu from "./AftermathMenu";
import { buildStatChangeRows, withKeptStats } from "./aftermath-stats";
import { buildXpRows } from "./aftermath-xp";
import ExperienceTab from "./ExperienceTab";
import ExploreTab from "./ExploreTab";
import FindsCard from "./FindsCard";
import InjuriesTab from "./InjuriesTab";
import ResultsBanner from "./ResultsBanner";
import StatChangesCard from "./StatChangesCard";

type AftermathBodyProps = {
  campaign: CampaignSummary | null;
  battle: PostgameBattle;
  battleState: BattleState;
  me: BattleParticipant;
  isMobile: boolean;
};

/** "3 heroes on their feet, +1 for winning": why the exploration has the dice it has. */
function exploreWhy(state: BattleState, me: BattleParticipant, onFeet: number) {
  const won = resultText(state, me.warband.id, me.declared_result).startsWith("Won");
  return `${onFeet} ${onFeet === 1 ? "hero" : "heroes"} on their feet${won ? ", +1 for winning" : ""}`;
}

/** The Aftermath of a loaded battle (design E): three tabs saved as you go, then camp. */
export default function AftermathBody({
  campaign,
  battle,
  battleState,
  me,
  isMobile,
}: AftermathBodyProps) {
  const campaignId = battleState.battle.campaign_id;
  const postgame = usePostgameDraft({
    campaignId,
    battleId: battleState.battle.id,
    battle,
    battleState,
    participant: me,
  });
  const [tab, setTab] = useState<AftermathTab>("injuries");
  const [readPlace, setReadPlace] = useState<string | null>(null);
  const { drafting, explore } = postgame;
  const { draft, persistDraft } = drafting;
  const warbandPath = `/campaigns/${campaignId}/warband`;
  if (!draft || !explore.exploration) {
    return <p className="text-sm text-muted-foreground">Reading your aftermath…</p>;
  }
  const save = (next: typeof draft) => void persistDraft(next);
  const index = AFTERMATH_TABS.findIndex((entry) => entry.id === tab);
  const opponents = opponentsOf(battleState, me);
  const result = resultText(battleState, me.warband.id, me.declared_result);
  const subtitle = [
    `${result}${opponents.length ? ` against ${opponents.join(", ")}` : ""}`,
    isMobile ? null : battleState.battle.scenario,
  ]
    .filter(Boolean)
    .join(" · ");
  const heroesOnFeet = Object.values(draft.unit_results).filter(
    (entry) => entry.unit_kind === "hero" && !entry.out_of_action
  ).length;

  const content =
    tab === "injuries" ? (
      <InjuriesTab
        draft={draft}
        roster={battle.roster}
        rules={battleState.rules}
        suggestion={battleState.suggested_postbattle}
        isMobile={isMobile}
        onChange={save}
      />
    ) : tab === "xp" ? (
      <>
        <StatChangesCard
          rows={buildStatChangeRows(draft, battle.roster, me.unit_information_json)}
          onKeep={(row, keep) => save(withKeptStats(draft, row, keep))}
        />
        <ExperienceTab
          draft={draft}
          rows={buildXpRows(draft, postgame.sheet, campaign, battleState.suggested_postbattle)}
          isMobile={isMobile}
          onChange={save}
        />
      </>
    ) : (
      <>
        <ExploreTab
          explore={explore}
          resources={postgame.resources}
          why={exploreWhy(battleState, me, heroesOnFeet)}
          isMobile={isMobile}
          onReadAndRoll={campaign?.enable_locations ? setReadPlace : undefined}
        />
        <FindsCard campaignId={campaignId} drafting={drafting} isMobile={isMobile} />
      </>
    );
  const back = () => (index > 0 ? setTab(AFTERMATH_TABS[index - 1].id) : undefined);
  const next = AFTERMATH_TABS[index + 1];
  const nav = (
    <div className={cn("flex items-center gap-2", isMobile ? "" : "pt-2.5")}>
      {index > 0 ? (
        <Button variant="secondary" className="min-h-12" onClick={back}>
          Back
        </Button>
      ) : (
        <Button asChild variant="secondary" className="min-h-12">
          <Link to={warbandPath}>{isMobile ? "Back" : "Back to warband"}</Link>
        </Button>
      )}
      {next ? (
        <Button
          className={cn("min-h-12 text-[15px]", isMobile ? "flex-1" : "ml-auto")}
          onClick={() => setTab(next.id)}
        >
          Next: {isMobile ? next.short : next.label}
          {isMobile ? null : <ArrowRight aria-hidden="true" />}
        </Button>
      ) : (
        <Button asChild className={cn("min-h-12 text-[15px]", isMobile ? "flex-1" : "ml-auto")}>
          <Link to={`${warbandPath}?camp=recruit`}>
            To camp
            {isMobile ? null : <ArrowRight aria-hidden="true" />}
          </Link>
        </Button>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-3 pb-24" : "gap-7")}>
      <AftermathHeader
        kicker={`${me.warband.name} · Aftermath`}
        title="After the battle"
        subtitle={subtitle}
        saving={drafting.isSavingDraft}
        error={drafting.draftError}
        tab={tab}
        onTab={setTab}
        warbandPath={warbandPath}
        isMobile={isMobile}
        menu={<AftermathMenu battle={battle} battleState={battleState} />}
      />
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
          <ResultsBanner state={battleState} results={postgame.results} />
          {drafting.draftError ? (
            <p className="m-0 text-sm text-danger">{drafting.draftError}</p>
          ) : null}
          {content}
          {isMobile ? null : nav}
        </div>
        {isMobile ? null : <AftermathAside state={battleState} me={me} draft={draft} />}
      </div>
      {isMobile ? (
        <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-rail px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-2.5">
          {nav}
        </footer>
      ) : null}
      <LocationsPanel
        campaignId={campaignId}
        warbandId={me.warband.id}
        heroes={[]}
        canEdit={false}
        open={readPlace !== null}
        onOpenChange={(open) => (open ? null : setReadPlace(null))}
        initialSearch={readPlace ?? undefined}
      />
    </div>
  );
}
