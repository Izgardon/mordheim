import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { useCampaignCharts } from "@/features/rules/api/rule-queries";
import type { ChartRow } from "@/features/rules/campaign-rule-rows";
import CampaignChartView from "@/features/rules/components/CampaignChartView";
import CampaignChartsModal from "@/features/rules/components/CampaignChartsModal";
import type { WarbandHero } from "@/features/warbands/types/warband-types";

import type { CampaignLocation } from "../types";
import LocationVisit from "./LocationVisit";

/** Who visits from here: your warband and its heroes. */
export type VisitFrom = { warbandId: number; heroes: WarbandHero[] };

/**
 * An open location: its rules, its own tables (side by side where they fit, stacked on a phone),
 * chips opening the campaign tables it points to, and Visit for your warband.
 */
export default function LocationDetail({
  campaignId,
  location,
  visit,
  actions,
}: {
  campaignId: number;
  location: CampaignLocation;
  visit?: VisitFrom | null;
  /** Edit and Remove, for those who manage locations. */
  actions?: React.ReactNode;
}) {
  const charts = useCampaignCharts(campaignId).data ?? [];
  const [opened, setOpened] = useState<ChartRow | null>(null);
  const open = (id: number) => {
    const chart = charts.find((entry) => entry.id === id);
    if (chart) setOpened({ key: `c${chart.id}`, name: chart.title, umbrella: "", charts: [chart] });
  };

  return (
    <div className="flex flex-col gap-3 pl-1">
      {location.rules ? (
        <p className="m-0 whitespace-pre-line text-sm text-text2">{location.rules}</p>
      ) : null}
      {location.tables.length ? (
        <div className="grid gap-5 min-[960px]:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
          {location.tables.map((table) => (
            <CampaignChartView key={table.id} chart={table} heading />
          ))}
        </div>
      ) : null}
      {location.charts.length ? (
        <div role="group" aria-label="Charts" className="flex flex-wrap gap-1.5">
          {location.charts.map((link) => (
            <Chip key={link.id} onClick={() => open(link.id)}>
              {link.title}
            </Chip>
          ))}
        </div>
      ) : null}
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      {visit ? (
        <LocationVisit location={location} warbandId={visit.warbandId} heroes={visit.heroes} />
      ) : null}
      <CampaignChartsModal row={opened} onClose={() => setOpened(null)} />
    </div>
  );
}
