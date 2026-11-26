import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { useReferenceActions } from "./reference-actions";

const CAPTION = "text-[11px] font-bold uppercase tracking-[0.14em] text-faint";

/** One filter with its small caption above it (the web); a phone shows the control alone. */
export function FilterField({
  label,
  isMobile,
  className,
  children,
}: {
  label: string;
  isMobile: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (isMobile) return <>{children}</>;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className={CAPTION}>{label}</span>
      {children}
    </div>
  );
}

/** The filters' first row: the search, then the page's toggles and pickers beside it. */
export function FilterRow({ isMobile, children }: { isMobile: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex gap-x-6 gap-y-2.5",
        isMobile ? "flex-col" : "flex-wrap items-end [&>*:first-child]:flex-[1_1_320px]"
      )}
    >
      {children}
    </div>
  );
}

type ReferenceSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** The field's accessible name: "Search wargear". */
  label: string;
  isMobile: boolean;
};

/** A reference page's search box; on a phone the page's buttons (Add new) sit beside it. */
export function ReferenceSearch({
  value,
  onChange,
  placeholder,
  label,
  isMobile,
}: ReferenceSearchProps) {
  const actions = useReferenceActions();
  const box = (
    <label className="flex min-h-11 min-w-0 items-center gap-2 border border-strong bg-rail px-3 text-muted-foreground">
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
      />
    </label>
  );
  return (
    <FilterField label="Search" isMobile={isMobile}>
      {isMobile && actions ? (
        <div className="flex items-center gap-2 [&>button]:min-h-11 [&>button]:shrink-0 [&>label]:flex-1">
          {box}
          {actions}
        </div>
      ) : (
        box
      )}
    </FilterField>
  );
}

/**
 * The big "What <warband> can buy" toggle (E-Mobile-Items): a full-width switch on a phone, a
 * captioned switch on the web.
 */
export function BuyableToggle({
  warbandName,
  checked,
  onChange,
  isMobile,
  verb = "buy",
}: {
  warbandName: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isMobile: boolean;
  /** "buy", or "hire" on the hired swords' pages. */
  verb?: string;
}) {
  const label = verb === "buy" ? `What ${warbandName} can buy` : `Who ${warbandName} can ${verb}`;
  return (
    <FilterField label={label} isMobile={isMobile} className="shrink-0">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={isMobile ? undefined : label}
        className={isMobile ? "min-h-[52px] w-full text-[15px]" : undefined}
      >
        {isMobile ? label : checked ? "On" : "Show all"}
      </Switch>
    </FilterField>
  );
}
