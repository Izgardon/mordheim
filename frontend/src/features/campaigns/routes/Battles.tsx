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
 * opening to its key moments; your unfinished battle and results to answer above them.
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
      <span className="text-[13px] text-faint">
        {battles.length} {battles.length === 1 ? "battle" : "battles"} fought
      </span>
      {history.isPending ? (
        <p className="m-0 text-sm text-muted-foreground">Reading the battles…</p>
      ) : history.error ? (
        <p className="m-0 text-sm text-danger">{getErrorMessage(history.error)}</p>
      ) : (
        <BattleRows battles={battles} isMobile={isMobile} />
      )}
    </div>
  );
}
