import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Standing } from "./overview-data";

const TH =
  "border-b border-border px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const TD = "border-b border-line px-3 py-[11px]";

/**
 * The standings (design E), by warband rating: each warband links to its warband page (yours
 * opens your own), and your row is picked out. A table on the web, a list on a phone.
 */
export default function StandingsTable({
  rows,
  campaignId,
  userId,
  isMobile,
}: {
  rows: Standing[];
  campaignId: number;
  userId: number | undefined;
  isMobile: boolean;
}) {
  const href = (row: Standing) =>
    row.playerId === userId
      ? `/campaigns/${campaignId}/warband`
      : `/campaigns/${campaignId}/warbands/${row.warbandId}`;
  if (!rows.length) {
    return <p className="m-0 text-sm text-text2">No warbands raised yet.</p>;
  }

  if (isMobile) {
    return (
      <ol className="m-0 list-none border border-border bg-surface p-0">
        {rows.map((row, index) => {
          const you = row.playerId === userId;
          return (
            <li key={row.warbandId} className={index ? "border-t border-line" : undefined}>
              <Link
                to={href(row)}
                className={cn(
                  "flex min-h-14 items-center gap-2.5 px-3 py-2",
                  you && "bg-raised shadow-[inset_2px_0_0_var(--color-accent)]"
                )}
              >
                <span className="w-[18px] shrink-0 font-mono text-xs text-muted-foreground">
                  {row.rank}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-display text-[15px] font-semibold text-head">
                    {row.warband}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {row.player} · {row.faction} · {row.record}
                  </span>
                </span>
                <span className="font-mono text-sm font-bold text-ink">{row.rating}</span>
                <ChevronRight className="h-4 w-4 text-faint" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="overflow-x-auto border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="bg-raised">
            <th scope="col" className={cn(TH, "w-9 pl-4 pr-2")}>
              #
            </th>
            <th scope="col" className={TH}>
              Warband
            </th>
            <th scope="col" className={TH}>
              Player
            </th>
            <th scope="col" className={TH}>
              Type
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              Rating
            </th>
            <th scope="col" className={cn(TH, "pr-4 text-right")}>
              <abbr title="Won, drawn, lost" className="no-underline">
                W/D/L
              </abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const you = row.playerId === userId;
            return (
              <tr
                key={row.warbandId}
                className={cn(you && "bg-raised shadow-[inset_2px_0_0_var(--color-accent)]")}
              >
                <td className={cn(TD, "pl-4 pr-2 font-mono text-muted-foreground")}>{row.rank}</td>
                <td className={TD}>
                  <Link
                    to={href(row)}
                    className="font-display text-base font-semibold text-head hover:text-accent-hi"
                  >
                    {row.warband}
                  </Link>
                  {you ? (
                    <span className="ml-2 border border-accent-line px-1.5 py-px text-[11px] font-bold text-accent-hi">
                      You
                    </span>
                  ) : null}
                </td>
                <td className={cn(TD, "text-text2")}>{row.player}</td>
                <td className={cn(TD, "text-text2")}>{row.faction}</td>
                <td className={cn(TD, "text-right font-mono font-bold text-ink")}>{row.rating}</td>
                <td className={cn(TD, "pr-4 text-right font-mono text-text2")}>{row.record}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
