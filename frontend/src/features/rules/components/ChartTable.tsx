import { Fragment } from "react";

import type { CampaignChartRow } from "../types/rule-types";

/**
 * A chart's results (William, 19 Nov 2026: "Charts should just have a title description and
 * chart"): what was rolled, its name and what it does. A chart whose results have no names, or no
 * text, leaves that column out rather than printing empty cells.
 *
 * A result the book hangs its own table off shows that table under it, across the whole width
 * (William, 20 Nov 2026), so a random occurrence reads as one thing rather than sending the player
 * to another chart.
 */
export default function ChartTable({ rows, dice }: { rows: CampaignChartRow[]; dice: string }) {
  const hasNames = rows.some((row) => row.name.trim());
  const hasText = rows.some((row) => row.text.trim());
  const columns = 1 + Number(hasNames) + Number(hasText);
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-strong text-left">
          <th
            scope="col"
            className="w-16 py-1.5 pr-3 align-top text-[11px] uppercase tracking-[0.12em] text-faint"
          >
            {dice || "Result"}
          </th>
          {hasNames ? (
            <th
              scope="col"
              className="py-1.5 pr-3 align-top text-[11px] uppercase tracking-[0.12em] text-faint"
            >
              Result
            </th>
          ) : null}
          {hasText ? (
            <th
              scope="col"
              className="py-1.5 align-top text-[11px] uppercase tracking-[0.12em] text-faint"
            >
              Effect
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const key = row.id ?? `${row.result}-${index}`;
          const table = row.chart;
          return (
            <Fragment key={key}>
              <tr className={table ? "" : "border-b border-line last:border-b-0"}>
                <td className="py-1.5 pr-3 align-top font-bold text-head">{row.result}</td>
                {hasNames ? (
                  <td className="py-1.5 pr-3 align-top font-semibold text-text2">{row.name}</td>
                ) : null}
                {hasText ? (
                  <td className="whitespace-pre-line py-1.5 align-top text-text2">{row.text}</td>
                ) : null}
              </tr>
              {table ? (
                <tr className="border-b border-line last:border-b-0">
                  <td colSpan={columns} className="pb-2.5 pl-3 pt-1">
                    <div className="flex flex-col gap-1.5 border-l-2 border-strong pl-3">
                      {table.description ? (
                        <p className="m-0 whitespace-pre-line text-[13px] text-text2">
                          {table.description}
                        </p>
                      ) : null}
                      {table.rows.length ? (
                        <ChartTable rows={table.rows} dice={table.dice} />
                      ) : null}
                      {table.note ? (
                        <p className="m-0 whitespace-pre-line text-xs text-muted-foreground">
                          {table.note}
                        </p>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
