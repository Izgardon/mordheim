import type { CSSProperties } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { RosterSkeleton } from "@components/card-skeleton";
import basicBar from "@/assets/containers/basic_bar.webp";

import type { CampaignPivotalMoment } from "../../types/campaign-types";

type PivotalMomentsTableProps = {
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
  isLoading,
  error,
  moments,
}: PivotalMomentsTableProps) {
  return (
    <Card className="w-full max-w-none">
      <CardHeader className="px-2 sm:px-6">
        <CardTitle>Pivotal Moments</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-0 sm:px-6">
        {isLoading ? (
          <RosterSkeleton rows={4} />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : moments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pivotal moments recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-[0_18px_32px_rgba(5,20,24,0.35)]">
            <div className="scrollbar-hidden-mobile max-h-[300px] overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-border/40 bg-black text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Moment</th>
                    <th className="px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Warband</th>
                    <th className="px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Battle</th>
                    <th className="px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {moments.map((moment, index) => (
                    <tr
                      key={moment.id}
                      className="border-b border-border/40 last:border-b-0"
                      style={{
                        ...OVERVIEW_ROW_BG_STYLE,
                        backgroundImage:
                          index % 2 === 0
                            ? `linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)), url(${basicBar})`
                            : `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), url(${basicBar})`,
                      }}
                    >
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
