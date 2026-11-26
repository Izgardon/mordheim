import { useMemo } from "react";

import { Disclaimer } from "@/components/ui/disclaimer";
import ReferencePage from "@/features/reference/ReferencePage";
import { FilterLine, FilterSelect } from "@/features/reference/FilterLine";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList } from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useMediaQuery } from "@/lib/use-media-query";

import { rulesTabs } from "../data/rules-content";
import RuleBookRow from "../components/RuleBookRow";
import { ruleEntries, ruleMatches } from "../rules-index";

/**
 * Rules (design E's reference layout): the bundled rulebook's sections as a filter and each headed
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
  const sections = [
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
          <FilterLine isMobile={isMobile}>
            <FilterSelect
              label="Section"
              allLabel="All sections"
              options={sections}
              value={section}
              onChange={(next) => params.set({ section: next === "all" ? null : next })}
              isMobile={isMobile}
            />
          </FilterLine>
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
        empty="Nothing in the rules says that."
      >
        {rows.map((entry) => (
          <RuleBookRow
            key={entry.id}
            entry={entry}
            open={params.isOpen(entry.id)}
            onToggle={() => params.toggle(entry.id)}
            query={params.query}
            isMobile={isMobile}
          />
        ))}
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
      <Disclaimer className="-mt-2" />
    </ReferencePage>
  );
}
