import { useEffect, useMemo, useRef } from "react";

import ReferencePage from "@/features/reference/ReferencePage";
import { FilterRow, ReferenceChips, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useMediaQuery } from "@/lib/use-media-query";

import { rulesTabs } from "../data/rules-content";
import { highlightRuleHtml, ruleEntries, ruleMatches, ruleSnippet } from "../rules-index";

/** An open block of the rulebook, its matches marked; the first one is scrolled to. */
function RuleBody({ html, query }: { html: string; query: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const marked = useMemo(() => highlightRuleHtml(html, query), [html, query]);
  useEffect(() => {
    if (!query.trim()) return;
    ref.current?.querySelector("mark")?.scrollIntoView({ block: "center" });
  }, [marked, query]);
  return <div ref={ref} className="rules-content" dangerouslySetInnerHTML={{ __html: marked }} />;
}

/**
 * Rules (design E's reference layout): the bundled rulebook's sections as chips and each headed
 * part as a row. The search looks inside the rules, not just the titles: a row shows the words
 * around its first match, and opens to the part with every match marked.
 */
export default function Rules() {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const params = useReferenceParams(true);
  const section = params.get("section", "all");
  const entries = useMemo(() => ruleEntries(), []);
  const searched = entries.filter((entry) => ruleMatches(entry, params.query));
  const rows = entries.filter(
    (entry) =>
      entry.id === params.openId ||
      (searched.includes(entry) && (section === "all" || entry.sectionId === section))
  );
  const chips = [
    { id: "all", label: "All", count: searched.length },
    ...rulesTabs.map((tab) => ({
      id: tab.id as string,
      label: tab.label,
      count: searched.filter((entry) => entry.sectionId === tab.id).length,
    })),
  ];
  const searching = Boolean(params.query.trim());

  return (
    <ReferencePage
      title="Rules"
      section="rules"
      filters={
        <>
          <FilterRow isMobile={isMobile}>
            <ReferenceSearch
              value={params.query}
              onChange={params.setQuery}
              placeholder="Search the rules"
              label="Search the rules"
              isMobile={isMobile}
            />
          </FilterRow>
          <ReferenceChips
            label="Section"
            options={chips}
            value={section}
            onChange={(next) => params.set({ section: next === "all" ? null : next })}
            isMobile={isMobile}
          />
        </>
      }
      summary={
        isMobile
          ? undefined
          : searching
            ? `${rows.length} ${rows.length === 1 ? "part" : "parts"} mention “${params.query.trim()}”`
            : `${rows.length} parts of the rulebook`
      }
    >
      <ReferenceList
        nameLabel="Rule"
        columns={isMobile ? undefined : [{ label: "Section", className: "w-[200px] shrink-0" }]}
        isEmpty={rows.length === 0}
        empty="Nothing in the rules says that. Try another word."
      >
        {rows.map((entry) => {
          const snippet = searching ? ruleSnippet(entry.text, params.query) : null;
          return (
            <ReferenceRow
              key={entry.id}
              id={entry.id}
              open={params.isOpen(entry.id)}
              onToggle={() => params.toggle(entry.id)}
              name={entry.title}
              sub={
                snippet ? (
                  <span className="text-text2">
                    {snippet.before}
                    <mark className="bg-accent-soft text-accent-hi">{snippet.match}</mark>
                    {snippet.after}
                  </span>
                ) : isMobile ? (
                  entry.section
                ) : undefined
              }
              cells={isMobile ? undefined : [entry.section]}
            >
              <div className={isMobile ? "pt-1" : "border-t border-accent-line bg-panel px-6 py-5"}>
                <RuleBody html={entry.html} query={params.query} />
              </div>
            </ReferenceRow>
          );
        })}
      </ReferenceList>
      <p className="m-0 text-xs text-muted-foreground">
        The rules are curated with help from{" "}
        <a
          href="https://www.mordheimer.net"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-accent-text underline decoration-dotted underline-offset-2"
        >
          mordheimer.net
        </a>
        , with thanks to the community keeping Mordheim alive.
      </p>
    </ReferencePage>
  );
}
