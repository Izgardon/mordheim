import type { CampaignChart } from "../types/rule-types";
import ChartTable from "./ChartTable";

/** One chart whole: when it is rolled, its results, and what is true of the chart rather than a
 * single result. Read only — a chart is looked up, never applied. */
export default function CampaignChartView({
  chart,
  heading,
}: {
  chart: CampaignChart;
  /** Its title, shown when the modal's own title is an umbrella's name rather than this chart's. */
  heading?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      {heading ? <h3 className="m-0 text-[15px] font-bold text-head">{chart.title}</h3> : null}
      {chart.description ? (
        <p className="m-0 whitespace-pre-line text-[13px] text-text2">{chart.description}</p>
      ) : null}
      {chart.rows.length ? <ChartTable rows={chart.rows} dice={chart.dice} /> : null}
      {chart.note ? (
        <p className="m-0 whitespace-pre-line text-xs text-muted-foreground">{chart.note}</p>
      ) : null}
    </section>
  );
}
