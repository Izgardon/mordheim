import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import type { CampaignBattleMoment } from "../../types/campaign-types";
import { momentParts } from "./overview-data";

/** Moments that cost a warband dear read in danger, the rest in accent. */
const DANGER = new Set(["wiped_out", "bloody_martyr", "pyrrhic_victory"]);

function MomentDetail({
  moment,
  campaignId,
}: {
  moment: CampaignBattleMoment;
  campaignId: number;
}) {
  const parts = momentParts(moment);
  if (!parts || !moment.unit) return <>{moment.detail}</>;
  // The unit on its warband page, its card opened (the `?unit=` link Search everything uses).
  const to = `/campaigns/${campaignId}/warbands/${moment.warband_id}?unit=${moment.unit.kind}-${moment.unit.id}`;
  return (
    <>
      {parts.before}
      <Link to={to} className="font-semibold text-accent-text hover:underline">
        {parts.name}
      </Link>
      {parts.after}
    </>
  );
}

/** One pivotal moment as a battle row lists it: its headline, its detail and its warband. */
export default function MomentLine({
  moment,
  campaignId,
  isMobile,
}: {
  moment: CampaignBattleMoment;
  campaignId: number;
  isMobile: boolean;
}) {
  const danger = DANGER.has(moment.kind);
  return isMobile ? (
    <li className="text-[13px] text-ink">
      <span className={cn("text-[11px] font-bold", danger ? "text-danger" : "text-accent-hi")}>
        {moment.headline}
      </span>{" "}
      · <MomentDetail moment={moment} campaignId={campaignId} />{" "}
      <span className="text-muted-foreground">· {moment.warband_name}</span>
    </li>
  ) : (
    <li className="flex items-baseline gap-2.5">
      <span
        className={cn(
          "shrink-0 border px-1.5 text-[11px] font-bold",
          danger ? "border-danger-line text-danger" : "border-accent-line text-accent-hi"
        )}
      >
        {moment.headline}
      </span>
      <span className="text-[13px] text-ink">
        <MomentDetail moment={moment} campaignId={campaignId} />
        <span className="text-muted-foreground"> · {moment.warband_name}</span>
      </span>
    </li>
  );
}
