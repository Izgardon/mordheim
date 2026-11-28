import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import { usePostgameDraft, type PostgameDraft } from "@/features/battles/hooks/usePostgameDraft";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";
import { numberedOr } from "@/features/battles/utils/battle-number";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { useCampaignExplorationChart } from "@/features/exploration/api/exploration-queries";
import type { FoundPlace } from "@/features/exploration/utils/places-found";
import { useTabScroll } from "@/lib/use-tab-scroll";
import { cn } from "@/lib/utils";

import AftermathAside, { opponentsOf, resultText } from "./AftermathAside";
import { AFTERMATH_BODY, AFTERMATH_MAIN } from "./aftermath-layout";
import { receivedLine } from "./aftermath-locks";
import AftermathHeader, { AFTERMATH_TABS, type AftermathTab } from "./AftermathHeader";
import AftermathMenu from "./AftermathMenu";
import AftermathSkeleton from "./AftermathSkeleton";
import { buildStatChangeRows, withKeptStats } from "./aftermath-stats";
import { buildXpRows } from "./aftermath-xp";
import { exploreWhy, useExploreWhy } from "./explore-why";
import ExperienceTab from "./ExperienceTab";
import ExploreTab from "./ExploreTab";
import FindsCard from "./FindsCard";
import InjuriesTab from "./InjuriesTab";
import PlaceRollPanel from "./PlaceRollPanel";
import ResultsBanner from "./ResultsBanner";
import SettledNote from "./SettledNote";
import StatChangesCard from "./StatChangesCard";

type AftermathBodyProps = {
  campaign: CampaignSummary | null;
  battle: PostgameBattle;
  battleState: BattleState;
  me: BattleParticipant;
  isMobile: boolean;
};

/**
 * Over a step already applied: what it gave the warband, and where to change it now (William,
 * 18 Nov 2026). The injuries and experience are still editable here and change the battle's
 * record; the gold and items found are read-only, and the exploration dice may still be corrected.
 */
function settled(tab: AftermathTab, locks: PostgameDraft["locks"]) {
  if (tab === "injuries" && locks.injuries) {
    return "These injuries are in your warband. A change here only corrects the battle's record: change a unit on their card.";
  }
  if (tab === "xp" && locks.xp) {
    return "This experience and these advances are in your warband. A change here only corrects the battle's record: change a unit on their card.";
  }
  if (tab === "explore" && locks.explore) {
    return `${receivedLine(locks.received)} already went to your warband. Sell or move an item from the stash, and change gold in the warband's ledger; the dice can still be corrected.`;
  }
  return null;
}

/** The Aftermath of a loaded battle (design E): three tabs, each applied when you leave it. */
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
  // the campaign's chart: its places and their rules text, which no broadcast carries (apps/exploration)
  const { data: chart } = useCampaignExplorationChart(campaignId);
  const [tab, setTab] = useState<AftermathTab>("injuries");
  const tabs = useTabScroll();
  // a tab keeps the tab bar at the top of the screen; Next and Back land at the step's start
  const pick = (next: AftermathTab) => {
    tabs.pick();
    setTab(next);
  };
  const step = (next: AftermathTab) => {
    tabs.reveal();
    setTab(next);
  };
  const [reading, setReading] = useState<{ found: FoundPlace | null; open: boolean }>({
    found: null,
    open: false,
  });
  const navigate = useNavigate();
  const { drafting, explore } = postgame;
  const { draft, persistDraft } = drafting;
  const warbandPath = `/campaigns/${campaignId}/warband`;
  const result = resultText(battleState, me.warband.id, me.declared_result);
  const heroesOnFeet = Object.values(draft?.unit_results ?? {}).filter(
    (entry) => entry.unit_kind === "hero" && !entry.out_of_action
  ).length;
  // the words are held from the moment the draft is loaded and the dice are in, never before it
  const why = useExploreWhy(
    explore.rolled && draft !== null,
    exploreWhy(heroesOnFeet, result.startsWith("Won"))
  );
  if (!draft || !explore.exploration) {
    return <AftermathSkeleton />;
  }
  const save = (next: typeof draft) => void persistDraft(next);
  const index = AFTERMATH_TABS.findIndex((entry) => entry.id === tab);
  const opponents = opponentsOf(battleState, me);
  const subtitle = [
    `${result}${opponents.length ? ` against ${opponents.join(", ")}` : ""}`,
    isMobile ? null : battleState.battle.scenario,
  ]
    .filter(Boolean)
    .join(" · ");

  const note = settled(tab, postgame.locks);
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
          chart={chart}
          resources={postgame.resources}
          why={why}
          isMobile={isMobile}
          onReadAndRoll={(found) => setReading({ found, open: true })}
        />
        <FindsCard
          campaignId={campaignId}
          drafting={drafting}
          isMobile={isMobile}
          settled={postgame.locks.explore}
        />
      </>
    );
  const back = () => (index > 0 ? step(AFTERMATH_TABS[index - 1].id) : undefined);
  const next = AFTERMATH_TABS[index + 1];
  // Next applies the step it leaves, there and then (William, 18 Nov 2026); it stays put if that
  // fails, so the error is read where the numbers are. After the last one his aftermath is done.
  const onward = async () => {
    if (!(await postgame.applyStep(tab))) return;
    if (next) step(next.id);
    else navigate(`${warbandPath}?camp=recruit`);
  };
  const applying = postgame.applyingStep !== null;
  const nav = (
    <div
      className={cn("flex items-center gap-2", isMobile ? "" : "mt-2.5 border-t border-line pt-5")}
    >
      {index > 0 ? (
        <Button variant="secondary" className="min-h-12" onClick={back}>
          Back
        </Button>
      ) : (
        <Button asChild variant="secondary" className="min-h-12">
          <Link to={warbandPath}>{isMobile ? "Back" : "Back to warband"}</Link>
        </Button>
      )}
      <Button
        className={cn("min-h-12 text-[15px]", isMobile ? "flex-1" : "ml-auto")}
        disabled={applying || drafting.isSavingDraft}
        onClick={() => void onward()}
      >
        {applying ? "Applying…" : next ? `Next: ${isMobile ? next.short : next.label}` : "To camp"}
        {isMobile || applying ? null : <ArrowRight aria-hidden="true" />}
      </Button>
    </div>
  );

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-3 pb-24" : "gap-7")}>
      <AftermathHeader
        kicker={`${me.warband.name} · Aftermath`}
        title={numberedOr(battleState.battle.number, "After battle", "After the battle")}
        subtitle={subtitle}
        saving={drafting.isSavingDraft}
        error={drafting.draftError}
        tab={tab}
        onTab={pick}
        tabsRef={tabs.barRef}
        warbandPath={warbandPath}
        isMobile={isMobile}
        menu={<AftermathMenu battle={battle} battleState={battleState} />}
      />
      <div className={AFTERMATH_BODY}>
        <div className={AFTERMATH_MAIN}>
          <ResultsBanner state={battleState} results={postgame.results} />
          {drafting.draftError ? (
            <p className="m-0 text-sm text-danger">{drafting.draftError}</p>
          ) : null}
          {note ? <SettledNote>{note}</SettledNote> : null}
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
      <PlaceRollPanel
        key={reading.found?.place.name}
        campaignId={campaignId}
        found={reading.found}
        open={reading.open}
        onOpenChange={(open) => setReading((now) => ({ ...now, open }))}
      />
    </div>
  );
}
