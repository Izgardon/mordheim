import { RuleBlock } from "@/features/reference/ReferenceDetail";
import { cn } from "@/lib/utils";

import type { ItemRuleLink, RuleTable } from "../types/item-types";
import { ruleName, ruleParts } from "../utils/item-rules";

/** A D6 table as a real table: its headings, then its rows with the roll first. */
export function RuleTableView({ table }: { table: RuleTable }) {
  return (
    <table className="my-1 w-full max-w-[72ch] border-collapse text-[13px]">
      {table.columns.length ? (
        <thead>
          <tr>
            {table.columns.map((column, index) => (
              <th
                key={index}
                className="border-b border-line px-1.5 py-1 text-left font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {table.rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, at) => (
              <td
                key={at}
                className={cn(
                  "border-b border-line px-1.5 py-1 align-top",
                  at === 0 ? "whitespace-nowrap font-mono text-accent-text" : "text-text2"
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One of an item's rules on its card: its name tagged "shared rule" or "this item", its summary,
 * and its text with its D6 tables where they stand.
 */
export default function ItemRuleBlock({ rule }: { rule: ItemRuleLink }) {
  const parts = ruleParts(rule);
  const summary = rule.text && rule.summary ? rule.summary : "";
  return (
    <RuleBlock
      name={
        <span className="flex flex-wrap items-baseline gap-2">
          {ruleName(rule)}
          <span
            className={cn(
              "border px-1.5 font-mono text-[10px] font-normal uppercase tracking-wider",
              rule.shared
                ? "border-accent-line text-accent-text"
                : "border-line text-muted-foreground"
            )}
          >
            {rule.shared ? "shared rule" : "this item"}
          </span>
        </span>
      }
    >
      {summary ? <span className="block font-semibold text-ink">{summary}</span> : null}
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <span key={index} className="block">
            {part.text}
          </span>
        ) : (
          <RuleTableView key={index} table={part.table} />
        )
      )}
    </RuleBlock>
  );
}
