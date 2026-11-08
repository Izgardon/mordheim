import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CampaignBattleHistoryEntry } from "../../types/campaign-types";
import BattleRecord from "./BattleRecord";
import MomentLine from "./MomentLine";
import { battleLine, momentGroups } from "./overview-data";
import { battleGroupRow, battleGroups } from "./overview-layout";

function Moments({
  battle,
  campaignId,
  isMobile,
}: {
  battle: CampaignBattleHistoryEntry;
  campaignId: number;
  isMobile: boolean;
}) {
  const groups = momentGroups(battle.moments);
  if (!groups.length) {
    return (
      <p
        className={cn(
          "m-0 pb-3 text-[13px] text-muted-foreground",
          isMobile ? "px-3" : "pl-[178px]"
        )}
      >
        No pivotal moments in this battle.
      </p>
    );
  }
  return (
    <ol className={battleGroups(isMobile)}>
      {groups.map((group) => (
        <li key={group.label} className={battleGroupRow(isMobile)}>
          <span className="pt-0.5 font-mono text-[11px] text-faint">{group.label}</span>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
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

/**
 * Battles (design E): one row per ended battle (date and scenario, who beat whom, how many
 * moments) that opens to its pivotal moments: the fight's by round, then the results, each with
 * its warband and a link to its unit. The overview shows the newest few, the Battles page every
 * one, each opening to its whole record (`record`: BattleRecord).
 */
export default function BattleRows({
  battles,
  campaignId,
  isMobile,
  record = false,
}: {
  battles: CampaignBattleHistoryEntry[];
  campaignId: number;
  isMobile: boolean;
  record?: boolean;
}) {
  // The newest battle starts open (undefined), until a row is toggled.
  const [picked, setOpenId] = useState<number | null | undefined>(undefined);
  const openId = picked === undefined ? (battles[0]?.id ?? null) : picked;
  if (!battles.length) {
    return <p className="m-0 text-sm text-text2">No battles fought yet.</p>;
  }
  return (
    <ul className="m-0 list-none border border-border bg-surface p-0">
      {battles.map((battle, index) => {
        const open = openId === battle.id;
        const line = battleLine(battle);
        const count = battle.moments?.length ?? 0;
        return (
          <li key={battle.id} className={index ? "border-t border-line" : undefined}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : battle.id)}
              className={cn(
                "flex w-full flex-wrap items-center text-left",
                isMobile ? "gap-2.5 px-3 py-[11px]" : "gap-x-5 gap-y-2 px-[18px] py-[13px]",
                open && "bg-raised"
              )}
            >
              <span
                className={cn(
                  "flex flex-col gap-px",
                  isMobile ? "min-w-0 flex-1" : "w-[140px] shrink-0"
                )}
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  {battle.number ? (
                    <span className={isMobile ? undefined : "block"}>
                      Battle {battle.number}
                      {isMobile ? " · " : ""}
                    </span>
                  ) : null}
                  {battle.date}
                  {isMobile ? ` · ${battle.scenario}` : ""}
                </span>
                {isMobile ? (
                  <span className="text-[13px] text-ink">
                    <span className="font-bold text-head">{line.first}</span> {line.verb}{" "}
                    <span className="font-bold text-head">{line.second}</span>
                  </span>
                ) : (
                  <span className="text-[13px] font-semibold text-text2">{battle.scenario}</span>
                )}
              </span>
              {isMobile ? null : (
                <>
                  <span className="min-w-0 flex-[1_1_260px] text-sm text-ink">
                    <span className="font-display text-base font-semibold text-head">
                      {line.first}
                    </span>{" "}
                    {line.verb}{" "}
                    <span className="font-display text-base font-semibold text-head">
                      {line.second}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {count} {count === 1 ? "moment" : "moments"}
                  </span>
                </>
              )}
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
            {open && record ? (
              <BattleRecord battle={battle} campaignId={campaignId} isMobile={isMobile} />
            ) : open ? (
              <Moments battle={battle} campaignId={campaignId} isMobile={isMobile} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
