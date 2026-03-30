import { Fragment } from "react";

import { ChevronDown } from "lucide-react";

import { RosterSkeleton } from "@components/card-skeleton";

import type { CampaignPivotalMoment } from "../../types/campaign-types";

type PivotalMomentsTableProps = {
  isMobile: boolean;
  mobileExpanded: boolean;
  onToggleMobileExpanded: () => void;
  isLoading: boolean;
  error: string;
  moments: CampaignPivotalMoment[];
};

export default function PivotalMomentsTable({
  isMobile,
  mobileExpanded,
  onToggleMobileExpanded,
  isLoading,
  error,
  moments,
}: PivotalMomentsTableProps) {
  return (
    <section className="w-full space-y-3">
      {isMobile ? (
        <button
          type="button"
          onClick={onToggleMobileExpanded}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={mobileExpanded}
        >
          <h2 className="text-base font-semibold text-foreground">Critical Events</h2>
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform ${
              mobileExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground"
            }`}
            aria-hidden="true"
          />
        </button>
      ) : (
        <h2 className="text-base font-semibold text-foreground">Critical Events</h2>
      )}
      {!isMobile || mobileExpanded ? (
        <>
        {isLoading ? (
          <RosterSkeleton rows={4} />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : moments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No critical events recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-[rgba(12,9,6,0.92)] shadow-[0_18px_32px_rgba(5,20,24,0.35)]">
            <div className="scrollbar-hidden-mobile max-h-[300px] overflow-x-auto overflow-y-auto">
              <div className="sticky top-0 z-20 grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)] border-b border-border/40 bg-black px-2 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:hidden">
                <p className="font-semibold">Event</p>
                <p className="font-semibold">Warband</p>
                <p className="font-semibold">Battle</p>
              </div>
              <table className="w-full text-left text-sm text-foreground">
                <thead className="sticky top-0 z-20 hidden sm:table-header-group">
                  <tr className="border-b border-border/40 bg-black text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="w-[42%] px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Event</th>
                    <th className="px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Warband</th>
                    <th className="px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Battle</th>
                    <th className="px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {moments.map((moment, index) => {
                    const rowClassName =
                      index % 2 === 0 ? "bg-[#16120e] hover:bg-[#1b1510]" : "bg-[#120f0b] hover:bg-[#17120d]";

                    return (
                      <Fragment key={moment.id}>
                        <tr className={`hidden border-b border-border/40 transition-colors sm:table-row ${rowClassName}`}>
                          <td className="px-2 py-2 align-top sm:px-4 sm:py-3">
                            <p className="font-semibold text-foreground">{moment.headline}</p>
                            <p className="text-xs text-muted-foreground">{moment.detail}</p>
                          </td>
                          <td className="px-2 py-2 align-top text-muted-foreground sm:px-4 sm:py-3">
                            {moment.warband_name}
                          </td>
                          <td className="px-2 py-2 align-top text-muted-foreground sm:px-4 sm:py-3">
                            {moment.battle_scenario || "-"}
                          </td>
                          <td className="px-2 py-2 align-top text-muted-foreground sm:px-4 sm:py-3">
                            {moment.date}
                          </td>
                        </tr>
                        <tr
                          className={`border-b border-border/40 transition-colors sm:hidden last:border-b-0 ${rowClassName}`}
                        >
                          <td
                            colSpan={4}
                            className="p-0"
                          >
                            <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-x-3 gap-y-2 px-2 py-2">
                              <p className="min-w-0 font-semibold leading-tight text-foreground">
                                {moment.headline}
                              </p>
                              <p className="min-w-0 truncate text-muted-foreground">
                                {moment.warband_name}
                              </p>
                              <p className="min-w-0 line-clamp-2 leading-tight text-muted-foreground">
                                {moment.battle_scenario || "-"}
                              </p>
                              <p className="col-span-3 text-xs text-muted-foreground">
                                {moment.detail}
                              </p>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>
      ) : null}
    </section>
  );
}
