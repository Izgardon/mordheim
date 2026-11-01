import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CampaignBattleHistoryEntry, CampaignBattleMoment } from "../../types/campaign-types";
import { battleLine, momentGroups, momentParts } from "./overview-data";

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
    <ol
      className={cn(
        "m-0 flex list-none flex-col",
        isMobile ? "px-3 pb-2.5" : "pb-3.5 pl-[178px] pr-[18px] pt-1"
      )}
    >
      {groups.map((group) => (
        <li
          key={group.label}
          className={cn(
            "border-t border-line py-2",
            isMobile ? "flex flex-col gap-1" : "grid grid-cols-[64px_minmax(0,1fr)] gap-3"
          )}
        >
          <span className="pt-0.5 font-mono text-[11px] text-faint">{group.label}</span>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {group.moments.map((moment) => {
              const danger = DANGER.has(moment.kind);
              return isMobile ? (
                <li key={moment.id} className="text-[13px] text-ink">
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      danger ? "text-danger" : "text-accent-hi"
                    )}
                  >
                    {moment.headline}
                  </span>{" "}
                  · <MomentDetail moment={moment} campaignId={campaignId} />{" "}
                  <span className="text-muted-foreground">· {moment.warband_name}</span>
                </li>
              ) : (
                <li key={moment.id} className="flex items-baseline gap-2.5">
                  <span
                    className={cn(
                      "shrink-0 border px-1.5 text-[11px] font-bold",
                      danger
                        ? "border-danger-line text-danger"
                        : "border-accent-line text-accent-hi"
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
            })}
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
 * one.
 */
export default function BattleRows({
  battles,
  campaignId,
  isMobile,
}: {
  battles: CampaignBattleHistoryEntry[];
  campaignId: number;
  isMobile: boolean;
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
            {open ? <Moments battle={battle} campaignId={campaignId} isMobile={isMobile} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
