import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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

/** A reference page's search box. */
export function ReferenceSearch({
  value,
  onChange,
  placeholder,
  label,
  isMobile,
}: ReferenceSearchProps) {
  return (
    <FilterField label="Search" isMobile={isMobile}>
      <label className="flex min-h-11 items-center gap-2 border border-strong bg-rail px-3 text-muted-foreground">
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

export type ChipOption<T extends string> = { id: T; label: string; count?: number };

type ReferenceChipsProps<T extends string> = {
  /** The group's name: "Type", "Lore". */
  label: string;
  options: ReadonlyArray<ChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  isMobile: boolean;
};

/** More than this many choices read better as a picker than as rows of chips (35 spell lores). */
const MAX_CHIPS = 9;

/**
 * One-of-many chips (a type, a lore, a section), each with its count when given; a long list of
 * choices becomes a captioned picker instead.
 */
export function ReferenceChips<T extends string>(props: ReferenceChipsProps<T>) {
  const { isMobile } = props;
  if (props.options.length > MAX_CHIPS) {
    return (
      <FilterField label={props.label} isMobile={isMobile} className="self-start">
        <select
          aria-label={props.label}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value as T)}
          className="min-h-11 min-w-[240px] border border-strong bg-rail px-2.5 text-sm text-ink"
        >
          {props.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
              {option.count !== undefined ? ` (${option.count})` : ""}
            </option>
          ))}
        </select>
      </FilterField>
    );
  }
  return (
    <div className={cn("flex items-center gap-2", isMobile && "-mx-4 overflow-x-auto px-4")}>
      {isMobile ? null : <span className={cn(CAPTION, "mr-2")}>{props.label}</span>}
      <div
        role="group"
        aria-label={props.label}
        className={cn("flex gap-1.5", isMobile ? "pb-0.5" : "flex-wrap")}
      >
        {props.options.map((option) => (
          <Chip
            key={option.id}
            pressed={props.value === option.id}
            className="shrink-0"
            onClick={() => props.onChange(option.id)}
          >
            {option.label}
            {option.count !== undefined && !isMobile ? (
              <span className="font-mono text-[11px] opacity-80">{option.count}</span>
            ) : null}
          </Chip>
        ))}
      </div>
    </div>
  );
}
