import type { ReactNode } from "react";

import type { CampaignEncampment, EncampmentTaker } from "../types";
import EncampmentHolding from "./EncampmentHolding";

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/** An open encampment: how it is gained, what holding it gives, and who may change its holder. */
export default function EncampmentDetail({
  campaignId,
  encampment,
  takers,
  actions,
}: {
  campaignId: number;
  encampment: CampaignEncampment;
  takers: EncampmentTaker[];
  /** Edit and Remove, for those who manage encampments. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 pl-1">
      {encampment.gained_by ? (
        <p className="m-0 flex flex-col gap-0.5">
          <span className={LABEL}>Gained by</span>
          <span className="text-sm text-ink">{encampment.gained_by}</span>
        </p>
      ) : null}
      {encampment.text ? (
        <p className="m-0 whitespace-pre-line text-sm text-text2">{encampment.text}</p>
      ) : null}
      <EncampmentHolding campaignId={campaignId} encampment={encampment} takers={takers} />
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
