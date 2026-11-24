import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { ChartRow, RuleRow } from "../campaign-rule-rows";
import CampaignChartView from "./CampaignChartView";
import ChartTable from "./ChartTable";

/** The gap between two entries an umbrella holds: a rule, so a heading does not run on from the
 * last one's buttons (William, 20 Nov 2026). */
const between = (index: number) => index > 0 && "mt-6 border-t border-strong pt-6";

/**
 * A row's rules, one after another: a lone rule's body, or an umbrella's rules each under its own
 * title. The Campaign rules page's modal and the battle Rules sheet's open row show this.
 */
export function RuleRowBody({
  row,
  actions,
}: {
  row: RuleRow;
  /** The owner's and admins' buttons for one rule: edit, and moving the row. */
  actions?: (ruleId: number) => ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {row.rules.map((rule, index) => (
        <section key={rule.id} className={cn("flex flex-col gap-1.5", between(index))}>
          {row.umbrella ? (
            <h3 className="m-0 text-[15px] font-bold text-head">{rule.title}</h3>
          ) : null}
          {rule.body ? (
            <p className="m-0 whitespace-pre-line text-[13px] text-text2">{rule.body}</p>
          ) : null}
          {rule.chart ? (
            <>
              {rule.chart.description ? (
                <p className="m-0 whitespace-pre-line text-[13px] text-text2">
                  {rule.chart.description}
                </p>
              ) : null}
              <ChartTable rows={rule.chart.rows} dice={rule.chart.dice} />
              {rule.chart.note ? (
                <p className="m-0 whitespace-pre-line text-xs text-muted-foreground">
                  {rule.chart.note}
                </p>
              ) : null}
            </>
          ) : null}
          {actions ? <div className="flex flex-wrap gap-2">{actions(rule.id)}</div> : null}
        </section>
      ))}
    </div>
  );
}

/** A row's charts, one after another: a lone chart, or an umbrella's charts each with its title. */
export function ChartRowBody({
  row,
  actions,
}: {
  row: ChartRow;
  actions?: (chartId: number) => ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {row.charts.map((chart, index) => (
        <div key={chart.id} className={cn("flex flex-col gap-2", between(index))}>
          <CampaignChartView chart={chart} heading={Boolean(row.umbrella)} />
          {actions ? <div className="flex flex-wrap gap-2">{actions(chart.id)}</div> : null}
        </div>
      ))}
    </div>
  );
}
