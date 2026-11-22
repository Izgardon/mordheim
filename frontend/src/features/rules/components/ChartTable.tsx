import { Fragment } from "react";

import type { CampaignChartRow } from "../types/rule-types";

/**
 * A chart's results (William, 19 Nov 2026: "Charts should just have a title description and
 * chart"): what was rolled, its name and what it does. A chart whose results have no names, or no
 * text, leaves that column out rather than printing empty cells.
 *
 * It opts out of the global table styling in index.css (William, 20 Nov 2026: "the x and y axis key
 * sections look strange"). That styling is for the big data tables: a box border round the table and
 * a sticky header on a filled background. On a chart it read as a title bar with a spreadsheet
 * corner cell, and a nested table put a band inside a band. Here the header is a line of small caps
 * over a rule, and the die sits beside the first column's heading rather than standing in for it.
 *
 * A result the book hangs its own table off shows that table under it, across the whole width
 * (William, 20 Nov 2026), so a random occurrence reads as one thing rather than sending the player
 * to another chart.
 */
/** The header's rule, and the small caps every heading wears. */
const HEAD = "border-b border-strong";
const CELL =
  "pb-1.5 pt-0 align-bottom text-[10px] font-bold uppercase tracking-[0.14em] text-faint";

export default function ChartTable({ rows, dice }: { rows: CampaignChartRow[]; dice: string }) {
  const hasNames = rows.some((row) => row.name.trim());
  const hasText = rows.some((row) => row.text.trim());
  const columns = 1 + Number(hasNames) + Number(hasText);
  return (
    <table className="w-full border-collapse border-0 text-[13px]">
      <thead className="static border-0 bg-transparent">
        <tr className={`${HEAD} text-left`}>
          {/* as narrow as its widest result, so the effect gets the room (William, 22 Nov 2026); a
              dice result ("11-15") keeps to one line, a place standing for one ("The Great
              Confluence") may wrap */}
          <th scope="col" className={`${CELL} w-px bg-transparent pr-3`}>
            {dice ? <span className="font-mono normal-case tracking-normal">{dice}</span> : "Roll"}
          </th>
          {hasNames ? (
            <th scope="col" className={`${CELL} bg-transparent pr-3`}>
              Result
            </th>
          ) : null}
          {hasText ? (
            <th scope="col" className={`${CELL} bg-transparent`}>
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
                <td
                  className={`${row.result.length > 7 ? "" : "whitespace-nowrap"} py-2 pr-3 align-top font-mono text-[12px] font-bold text-head`}
                >
                  {row.result}
                </td>
                {hasNames ? (
                  <td className="py-2 pr-3 align-top font-semibold text-text2">{row.name}</td>
                ) : null}
                {hasText ? (
                  <td className="whitespace-pre-line py-2 align-top text-text2">{row.text}</td>
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
