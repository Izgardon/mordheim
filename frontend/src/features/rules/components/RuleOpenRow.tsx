import { ChevronRight } from "lucide-react";

/**
 * A row on the Campaign rules page: it opens a modal rather than expanding in place (William, 19
 * Nov 2026: "they should each get their own modal appear"), so it is a plain button with the
 * chevron pointing on, not a disclosure.
 */
export default function RuleOpenRow({
  name,
  sub,
  onOpen,
}: {
  name: string;
  /** The line under the heading: "3 rules", "D66 · 32 results". */
  sub?: string;
  onOpen: () => void;
}) {
  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full items-center gap-3 bg-transparent px-3 py-2 text-left hover:bg-raised"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-bold text-head">{name}</span>
          {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </li>
  );
}
