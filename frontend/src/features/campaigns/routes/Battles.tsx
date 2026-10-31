import { useOutletContext, useParams } from "react-router-dom";

import { getErrorMessage } from "@/lib/get-error-message";
import { useMediaQuery } from "@/lib/use-media-query";

import { useCampaignBattleHistory } from "../api/campaign-queries";
import BattleRows from "../components/overview/BattleRows";
import OverviewNotices from "../components/overview/OverviewNotices";
import { campaignCapabilities } from "../capabilities";
import type { CampaignLayoutContext } from "./CampaignLayout";

/**
 * The Battles page (the rail's Battles, design E's rows): every ended battle, newest first, each
 * opening to its pivotal moments; your unfinished battle and results to answer above them.
 */
export default function Battles() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const history = useCampaignBattleHistory(campaignId);
  const battles = history.data ?? [];

  return (
    <div className="flex flex-col gap-6 pb-14 max-[960px]:gap-3">
      {isMobile ? null : (
        <header className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            {campaign?.name}
          </span>
          <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head">
            Battles
          </h1>
        </header>
      )}
      <OverviewNotices
        campaignId={campaignId}
        managesBattles={campaignCapabilities(campaign).manage_battles}
      />
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5">
        <h2 className="m-0 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          Every battle
        </h2>
        <span className="font-mono text-xs text-faint">
          {battles.length} {battles.length === 1 ? "battle" : "battles"} fought
        </span>
      </div>
      {history.isPending ? (
        <p className="m-0 text-sm text-muted-foreground">Reading the battles…</p>
      ) : history.error ? (
        <p className="m-0 text-sm text-danger">{getErrorMessage(history.error)}</p>
      ) : (
        <BattleRows battles={battles} campaignId={campaignId} isMobile={isMobile} />
      )}
    </div>
  );
}
