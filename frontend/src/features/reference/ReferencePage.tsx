import type { ReactNode } from "react";

import { Switch } from "@/components/ui/switch";
import { useCatalogueSearchParams } from "@/features/catalogue/hooks/useCatalogueSearchParams";
import { RULES_LINKS } from "@/layouts/shell/campaign-nav";
import { useMediaQuery } from "@/lib/use-media-query";

import ArchivedEntries, { type ArchivedOptions } from "./ArchivedEntries";
import { ReferenceActionsContext } from "./reference-actions";

type ReferencePageProps = {
  title: string;
  /** The page's path under the campaign ("items"): its eyebrow reads from it. */
  section: string;
  /** The eyebrow, where it isn't the section's ("Campaign" over Scenarios). */
  eyebrow?: string;
  /** Plain buttons beside the title (Add new); on a phone, beside the search box. */
  actions?: ReactNode;
  /** The filters: search, toggles, chips. */
  filters?: ReactNode;
  /** One line above the list: "12 skills shown". */
  summary?: ReactNode;
  /**
   * The page's catalogue kind (or kinds: skills and skill groups): a Show archived switch beside
   * the summary lists their archived entries above the list (`?archived=1`), each with Restore.
   */
  archived?: ArchivedOptions | ArchivedOptions[];
  children: ReactNode;
};

/** The eyebrow over a page's title: its section's, "Rules" for the Rules section's pages. */
const eyebrowOf = (section: string) =>
  RULES_LINKS.some((link) => link.path === section) ? "Rules" : "Reference";

/**
 * The reference pages' one layout (design E, E-Web-Items and E-Mobile-Items): "Reference" (or
 * "Rules") and the title with the page's buttons (on a phone the shell's top bar names the page
 * and the buttons sit beside the search box), the filters, a summary line with Show archived (the archived
 * entries, while shown), and the list of rows that open in place.
 */
export default function ReferencePage(props: ReferencePageProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const url = useCatalogueSearchParams();
  const archived = props.archived ? [props.archived].flat() : [];
  const showArchived = archived.length > 0 && url.get("archived") === "1";
  // on a phone the search box shows the buttons beside it; a page with no filters shows them alone
  const actionsBySearch = isMobile && Boolean(props.filters);
  return (
    <ReferenceActionsContext.Provider value={actionsBySearch ? (props.actions ?? null) : null}>
      <div className="flex flex-col gap-6 pb-14 max-[960px]:gap-2.5">
        {isMobile ? (
          props.actions && !actionsBySearch ? (
            <div className="flex flex-wrap justify-end gap-2">{props.actions}</div>
          ) : null
        ) : (
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
                {props.eyebrow ?? eyebrowOf(props.section)}
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
        {props.summary || archived.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="m-0 text-[13px] text-text2">
              {props.summary}
            </p>
            {archived.length ? (
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
        {showArchived
          ? archived.map((options) => <ArchivedEntries key={options.kind} options={options} />)
          : null}
        {props.children}
      </div>
    </ReferenceActionsContext.Provider>
  );
}
