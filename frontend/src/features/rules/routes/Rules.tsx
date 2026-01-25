import { useEffect, useMemo, useRef, useState } from "react";

// components
import { CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import TabbedCard from "../../../components/ui/tabbed-card";

// data
import { rulesTabs } from "../data/rules-content";

type RulesTabId = (typeof rulesTabs)[number]["id"];

type HeadingResult = {
  tabId: RulesTabId;
  tabLabel: string;
  id: string;
  text: string;
  level: number;
};

export default function Rules() {
  const [activeTab, setActiveTab] = useState<RulesTabId>(rulesTabs[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<HeadingResult | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const activeContent = rulesTabs.find((tab) => tab.id === activeTab) ?? rulesTabs[0];

  const headingIndex = useMemo<HeadingResult[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const parser = new DOMParser();
    return rulesTabs.flatMap((tab) => {
      const doc = parser.parseFromString(tab.content, "text/html");
      return Array.from(doc.querySelectorAll("h2, h3, h4"))
        .map((heading) => ({
          tabId: tab.id,
          tabLabel: tab.label,
          id: heading.id,
          text: (heading.textContent ?? "").replace(/\s+/g, " ").trim(),
          level: Number(heading.tagName.replace("H", "")),
        }))
        .filter((heading) => heading.id && heading.text);
    });
  }, []);

  const filteredHeadings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return headingIndex.filter((heading) => heading.text.toLowerCase().includes(query));
  }, [headingIndex, searchQuery]);

  const handleHeadingSelect = (heading: HeadingResult) => {
    setActiveTab(heading.tabId);
    setPendingTarget(heading);
    setIsSearchOpen(false);
  };

  useEffect(() => {
    if (!pendingTarget || pendingTarget.tabId !== activeTab) {
      return;
    }

    const target = document.getElementById(pendingTarget.id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setPendingTarget(null);
  }, [activeTab, pendingTarget]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!searchRef.current) {
        return;
      }
      if (!searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setIsSearchOpen(false);
    } else {
      setIsSearchOpen(true);
    }
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Rules reference
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Mordheim rules</h1>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div ref={searchRef} className="relative w-full max-w-md space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Search headings
          </label>
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => {
              if (searchQuery.trim()) {
                setIsSearchOpen(true);
              }
            }}
            placeholder="Find leadership, movement, armour..."
            aria-label="Search rules headings"
          />
          {isSearchOpen ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-auto rounded-2xl border border-border/60 bg-card/95 p-2 shadow-[0_18px_30px_rgba(5,20,24,0.4)]">
              {filteredHeadings.length ? (
                <div className="grid gap-2">
                  {filteredHeadings.map((heading) => (
                    <button
                      key={`${heading.tabId}-${heading.id}`}
                      type="button"
                      onClick={() => handleHeadingSelect(heading)}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/50 hover:bg-background/80"
                    >
                      <span>{heading.text}</span>
                      <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        {heading.tabLabel}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-1 text-sm text-muted-foreground">
                  No headings match that search yet.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <TabbedCard
        tabs={rulesTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        header={<CardTitle>{activeContent.label}</CardTitle>}
      >
        <div className="rules-content" dangerouslySetInnerHTML={{ __html: activeContent.content }} />
      </TabbedCard>
    </div>
  );
}
