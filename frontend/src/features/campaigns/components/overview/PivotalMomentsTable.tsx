import { Fragment } from "react";
import type { CSSProperties } from "react";

import { ChevronDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { RosterSkeleton } from "@components/card-skeleton";
import basicBar from "@/assets/containers/basic_bar.webp";

import type { CampaignPivotalMoment } from "../../types/campaign-types";

type PivotalMomentsTableProps = {
  isMobile: boolean;
  mobileExpanded: boolean;
  onToggleMobileExpanded: () => void;
  isLoading: boolean;
  error: string;
  moments: CampaignPivotalMoment[];
};

const OVERVIEW_ROW_BG_STYLE: CSSProperties = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
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
    <Card className="w-full max-w-none">
      <CardHeader className="px-2 sm:px-6">
        {isMobile ? (
          <button
            type="button"
            onClick={onToggleMobileExpanded}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={mobileExpanded}
          >
            <CardTitle>Critical Events</CardTitle>
            <ChevronDown
              className={`h-5 w-5 shrink-0 transition-transform ${
                mobileExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground"
              }`}
              aria-hidden="true"
            />
          </button>
        ) : (
          <CardTitle>Critical Events</CardTitle>
        )}
      </CardHeader>
      {!isMobile || mobileExpanded ? (
      <CardContent className="px-2 pt-0 sm:px-6">
        {isLoading ? (
          <RosterSkeleton rows={4} />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : moments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No critical events recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-[0_18px_32px_rgba(5,20,24,0.35)]">
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
                    const rowStyle = {
                      ...OVERVIEW_ROW_BG_STYLE,
                      backgroundImage:
                        index % 2 === 0
                          ? `linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)), url(${basicBar})`
                          : `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), url(${basicBar})`,
                    };

                    return (
                      <Fragment key={moment.id}>
                        <tr className="hidden border-b border-border/40 sm:table-row" style={rowStyle}>
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
                          className="border-b border-border/40 sm:hidden last:border-b-0"
                        >
                          <td
                            colSpan={4}
                            className="p-0"
                            style={rowStyle}
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
      </CardContent>
      ) : null}
    </Card>
  );
}
