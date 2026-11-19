import type { CampaignChartRow } from "../types/rule-types";

/**
 * A chart's results (William, 19 Nov 2026: "Charts should just have a title description and
 * chart"): what was rolled, its name and what it does. A chart whose results have no names, or no
 * text, leaves that column out rather than printing empty cells.
 */
export default function ChartTable({ rows, dice }: { rows: CampaignChartRow[]; dice: string }) {
  const hasNames = rows.some((row) => row.name.trim());
  const hasText = rows.some((row) => row.text.trim());
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
        {rows.map((row, index) => (
          <tr
            key={row.id ?? `${row.result}-${index}`}
            className="border-b border-line last:border-b-0"
          >
            <td className="py-1.5 pr-3 align-top font-bold text-head">{row.result}</td>
            {hasNames ? (
              <td className="py-1.5 pr-3 align-top font-semibold text-text2">{row.name}</td>
            ) : null}
            {hasText ? (
              <td className="whitespace-pre-line py-1.5 align-top text-text2">{row.text}</td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
