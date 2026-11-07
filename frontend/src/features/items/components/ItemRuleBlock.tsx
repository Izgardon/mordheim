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
 * One of an item's rules on its card: a shared rule's name tagged "shared rule", the item's own
 * under its own name or, unnamed, the item's (William, 7 Nov 2026: "on items with their own rule
 * can we change the Rule title to the items name and drop the this item pill"), its summary, and
 * its text with its D6 tables where they stand.
 */
export default function ItemRuleBlock({
  rule,
  itemName,
}: {
  rule: ItemRuleLink;
  itemName: string;
}) {
  const parts = ruleParts(rule);
  const summary = rule.text && rule.summary ? rule.summary : "";
  return (
    <RuleBlock
      name={
        rule.shared ? (
          <span className="flex flex-wrap items-baseline gap-2">
            {ruleName(rule)}
            <span className="border border-accent-line px-1.5 font-mono text-[10px] font-normal uppercase tracking-wider text-accent-text">
              shared rule
            </span>
          </span>
        ) : (
          rule.name.trim() || itemName
        )
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
