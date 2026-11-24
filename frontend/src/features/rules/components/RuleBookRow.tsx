import { useEffect, useMemo, useRef } from "react";

import { ReferenceRow } from "@/features/reference/ReferenceList";

import { highlightRuleHtml, ruleSnippet, type RuleEntry } from "../rules-index";

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
 * One headed part of the bundled rulebook as a row that opens in place: the Rules page's, and the
 * battle Rules sheet's Rules. A search shows the words around its first match under the title, and
 * the open part has every match marked.
 */
export default function RuleBookRow({
  entry,
  open,
  onToggle,
  query = "",
  isMobile,
}: {
  entry: RuleEntry;
  open: boolean;
  onToggle: () => void;
  query?: string;
  isMobile: boolean;
}) {
  const snippet = query.trim() ? ruleSnippet(entry.text, query) : null;
  return (
    <ReferenceRow
      id={entry.id}
      open={open}
      onToggle={onToggle}
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
        {/* Static, bundled rules text (features/rules/data), not user content. */}
        <RuleBody html={entry.html} query={query} />
      </div>
    </ReferenceRow>
  );
}
