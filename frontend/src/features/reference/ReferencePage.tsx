import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Switch } from "@/components/ui/switch";
import { useCatalogueSearchParams } from "@/features/catalogue/hooks/useCatalogueSearchParams";
import { REFERENCE_LINKS } from "@/layouts/shell/campaign-nav";
import { useMediaQuery } from "@/lib/use-media-query";

import ArchivedEntries, { type ArchivedOptions } from "./ArchivedEntries";

type ReferencePageProps = {
  title: string;
  /** The page's path under the campaign ("items"): the phone's Section picker shows it. */
  section: string;
  /** Plain buttons beside the title: Add skill, Add house rule. */
  actions?: ReactNode;
  /** The filters: search, toggles, chips. */
  filters?: ReactNode;
  /** One line above the list: "12 skills shown". */
  summary?: ReactNode;
  /**
   * The page's catalogue kind: a Show archived switch beside the summary lists its archived
   * entries above the list (`?archived=1`), each with Restore.
   */
  archived?: ArchivedOptions;
  children: ReactNode;
};

/** Every reference section, then Search everything: what the phone's Section picker offers. */
export const REFERENCE_SECTIONS = [
  ...REFERENCE_LINKS,
  { label: "Search everything", path: "search" },
];

/**
 * The phone's Section picker (design E): the reference sections sit behind it, at the top of each
 * reference page, beside the page's own buttons.
 */
export function SectionPicker({ current, actions }: { current: string; actions?: ReactNode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-muted-foreground">
        Section
        <select
          aria-label="Reference section"
          value={current}
          onChange={(event) => navigate(`/campaigns/${id}/${event.target.value}`)}
          className="min-h-10 min-w-0 border border-border bg-surface px-2 text-sm text-ink"
        >
          {REFERENCE_SECTIONS.map((link) => (
            <option key={link.path} value={link.path}>
              {link.label}
            </option>
          ))}
        </select>
      </label>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * The reference pages' one layout (design E, E-Web-Items and E-Mobile-Items): "Reference" and the
 * title with the page's buttons (on a phone the Section picker instead, the shell's top bar naming
 * the page), the filters, a summary line with Show archived (the archived entries, while shown), and
 * the list of rows that open in place.
 */
export default function ReferencePage(props: ReferencePageProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const url = useCatalogueSearchParams();
  const showArchived = Boolean(props.archived) && url.get("archived") === "1";
  return (
    <div className="flex flex-col gap-6 pb-14 max-[960px]:gap-2.5">
      {isMobile ? (
        <SectionPicker current={props.section} actions={props.actions} />
      ) : (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
              Reference
            </span>
            <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head">
              {props.title}
            </h1>
          </div>
          {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
        </header>
      )}
      {props.filters ? (
        <section
          aria-label="Filters"
          className="flex flex-col gap-4 border-b border-line pb-5 max-[960px]:gap-2.5 max-[960px]:border-0 max-[960px]:pb-0"
        >
          {props.filters}
        </section>
      ) : null}
      {props.summary || props.archived ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="m-0 text-[13px] text-text2">
            {props.summary}
          </p>
          {props.archived ? (
            <Switch
              checked={showArchived}
              onCheckedChange={(on) => url.set({ archived: on ? "1" : null })}
              className="min-h-9"
            >
              Show archived
            </Switch>
          ) : null}
        </div>
      ) : null}
      {props.archived && showArchived ? <ArchivedEntries options={props.archived} /> : null}
      {props.children}
    </div>
  );
}
