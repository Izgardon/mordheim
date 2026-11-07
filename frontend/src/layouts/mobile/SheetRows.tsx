import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const ROW =
  "flex min-h-[52px] w-full items-center justify-between gap-2.5 border-t border-line px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

type RowContentProps = { label: string; detail?: string; danger?: boolean };

function RowContent({ label, detail, danger = false }: RowContentProps) {
  return (
    <>
      <span className="flex flex-col">
        <span className={cn("text-[15px] font-bold", danger ? "text-danger" : "text-ink")}>
          {label}
        </span>
        {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );
}

/** A sheet's list; with a `label`, a headed group of its own. */
export function SheetRows({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div role={label ? "group" : undefined} aria-label={label} className="flex flex-col">
      {label ? (
        <h3 className="px-1 pb-1.5 pt-2 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          {label}
        </h3>
      ) : null}
      {children}
    </div>
  );
}

/** A row that goes to a page; `onNavigate` closes the sheet. */
export function SheetLinkRow({
  to,
  onNavigate,
  ...content
}: RowContentProps & { to: string; onNavigate: () => void }) {
  return (
    <Link to={to} onClick={onNavigate} className={ROW}>
      <RowContent {...content} />
    </Link>
  );
}

/** A row that acts (opens the chat, finishes the battle). */
export function SheetButtonRow({
  onSelect,
  disabled,
  ...content
}: RowContentProps & { onSelect: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(ROW, "disabled:opacity-50")}
    >
      <RowContent {...content} />
    </button>
  );
}
