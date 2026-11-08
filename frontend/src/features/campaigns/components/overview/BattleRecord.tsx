import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useBattleRecord } from "../../api/campaign-queries";
import type {
  BattleRecord as RecordData,
  BattleRecordOut,
  CampaignBattleHistoryEntry,
} from "../../types/campaign-types";
import MomentLine from "./MomentLine";
import { aftermathText, recordGroups } from "./overview-data";
import { battleGroupRow, battleGroups } from "./overview-layout";

const NAME = "font-semibold text-head";

function OutLine({ out }: { out: BattleRecordOut }) {
  return (
    <li className="text-[13px] text-ink">
      <span className={NAME}>{out.name}</span>
      {out.by ? (
        <>
          {" "}
          taken out by <span className={NAME}>{out.by}</span>
        </>
      ) : (
        " out of action"
      )}
      <span className="text-muted-foreground"> · {out.warband_name || "Neutral"}</span>
    </li>
  );
}

function Aftermath({ warbands }: { warbands: RecordData["aftermath"] }) {
  return (
    <>
      {warbands.map((warband) => (
        <li key={warband.warband_id} className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {warband.warband_name}
          </span>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {warband.units.map((unit, index) => (
              <li key={`${unit.name}-${index}`} className="text-[13px] text-ink">
                <span className={NAME}>{unit.name}</span>
                {unit.group_name ? ` (${unit.group_name})` : ""}:{" "}
                <span className={unit.dead ? "font-semibold text-danger" : undefined}>
                  {aftermathText(unit)}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </>
  );
}

/**
 * The Battles page's open battle, the whole of it (William, 7 Nov 2026: "battles: just do put out
 * of action, can then also show what happened to units in that battle after if they got injuries
 * or died"): turn by turn, each unit put out of action in order, by whom where a kill was
 * recorded, with the turn's pivotal moments; then After, each warband's serious injuries and
 * deaths from its Aftermath and the result moments. Read when the row opens.
 */
export default function BattleRecord({
  battle,
  campaignId,
  isMobile,
}: {
  battle: CampaignBattleHistoryEntry;
  campaignId: number;
  isMobile: boolean;
}) {
  const record = useBattleRecord(campaignId, battle.id);
  const quiet = cn("m-0 pb-3 text-[13px]", isMobile ? "px-3" : "pl-[178px]");
  if (record.isPending)
    return <p className={cn(quiet, "text-muted-foreground")}>Reading the battle…</p>;
  if (record.error)
    return <p className={cn(quiet, "text-danger")}>{getErrorMessage(record.error)}</p>;
  const groups = recordGroups(record.data, battle.moments);
  if (!groups.length) {
    return <p className={cn(quiet, "text-muted-foreground")}>Nothing recorded for this battle.</p>;
  }
  return (
    <ol className={battleGroups(isMobile)}>
      {groups.map((group) => (
        <li key={group.label} className={battleGroupRow(isMobile)}>
          <span className="pt-0.5 font-mono text-[11px] text-faint">{group.label}</span>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {group.outs.map((out, index) => (
              <OutLine key={`out-${index}`} out={out} />
            ))}
            <Aftermath warbands={group.aftermath} />
            {group.moments.map((moment) => (
              <MomentLine
                key={moment.id}
                moment={moment}
                campaignId={campaignId}
                isMobile={isMobile}
              />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
