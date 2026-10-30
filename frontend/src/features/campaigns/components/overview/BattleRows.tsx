import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CampaignBattleHistoryEntry, CampaignBattleMoment } from "../../types/campaign-types";
import { MOMENT_LABEL, battleLine, momentGroups } from "./overview-data";

const TAG: Record<CampaignBattleMoment["kind"], string> = {
  kill: "border-accent-line text-accent-hi",
  ooa: "border-danger-line text-danger",
  find: "border-accent-line text-accent-hi",
  death: "border-danger-line text-danger",
};
const TEXT: Record<CampaignBattleMoment["kind"], string> = {
  kill: "text-accent-hi",
  ooa: "text-danger",
  find: "text-accent-hi",
  death: "text-danger",
};

function Moments({ battle, isMobile }: { battle: CampaignBattleHistoryEntry; isMobile: boolean }) {
  const groups = momentGroups(battle.moments);
  if (!groups.length) {
    return (
      <p
        className={cn(
          "m-0 pb-3 text-[13px] text-muted-foreground",
          isMobile ? "px-3" : "pl-[178px]"
        )}
      >
        No moments recorded: a reported result, or a fight with no kills.
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
            {group.moments.map((moment, index) =>
              isMobile ? (
                <li key={index} className="text-[13px] text-ink">
                  <span className={cn("text-[11px] font-bold", TEXT[moment.kind])}>
                    {MOMENT_LABEL[moment.kind]}
                  </span>{" "}
                  · {moment.text}
                </li>
              ) : (
                <li key={index} className="flex items-baseline gap-2.5">
                  <span
                    className={cn("shrink-0 border px-1.5 text-[11px] font-bold", TAG[moment.kind])}
                  >
                    {MOMENT_LABEL[moment.kind]}
                  </span>
                  <span className="text-[13px] text-ink">{moment.text}</span>
                </li>
              )
            )}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/**
 * Battles (design E): one row per ended battle (date and scenario, who beat whom, how many
 * moments) that opens to its key moments, grouped During and After. The overview shows the
 * newest few, the Battles page every one.
 */
export default function BattleRows({
  battles,
  isMobile,
}: {
  battles: CampaignBattleHistoryEntry[];
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
            {open ? <Moments battle={battle} isMobile={isMobile} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
