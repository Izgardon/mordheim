import { useEffect, useMemo, useRef, useState } from "react";

// routing
import { useNavigate, useParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

// components
import { CardTitle } from "@components/card";
import { Input } from "@components/input";
import TabbedCard from "@components/tabbed-card";
import { PageHeader } from "@components/page-header";
import MobileTabs from "@components/mobile-tabs";

// data
import { rulesTabs } from "../data/rules-content";

type RulesTabId = (typeof rulesTabs)[number]["id"];

const rulesNavTabs = [
  { id: "rules", label: "Rules" },
  { id: "house-rules", label: "House Rules" },
] as const;

type HeadingResult = {
  tabId: RulesTabId;
  tabLabel: string;
  id: string;
  text: string;
  level: number;
};

export default function Rules() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 960px)");
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

  const handleRulesNavChange = (tabId: (typeof rulesNavTabs)[number]["id"]) => {
    if (!id) {
      return;
    }
    navigate(`/campaigns/${id}/${tabId}`);
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
    <div className="min-h-0 space-y-4 sm:space-y-6">
      <PageHeader
        title="Mordheim Rules"
        subtitle="Core game rules and mechanics"
        tabs={rulesTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {isMobile ? (
        <MobileTabs
          tabs={rulesNavTabs}
          activeTab="rules"
          onTabChange={handleRulesNavChange}
          className="mt-2"
        />
      ) : null}

      <TabbedCard
        tabs={rulesTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabsClassName="hidden"
        className="p-4 sm:p-7"
        contentClassName="pt-4 sm:pt-6"
        header={
          <div className="space-y-4">
            <div className="rules-callout text-sm text-muted-foreground">
              Rules content is lovingly curated with help from{" "}
              <a
                href="https://www.mordheimer.net"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-foreground underline decoration-dotted underline-offset-2 transition hover:text-foreground/80"
              >
                mordheimer.net
              </a>{" "}
              - huge thanks to the community for keeping the Mordheim flame alive.
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <CardTitle>{activeContent.label}</CardTitle>
              <div ref={searchRef} className="relative w-full max-w-sm">
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim()) {
                      setIsSearchOpen(true);
                    }
                  }}
                  placeholder="Search headings..."
                  aria-label="Search rules headings"
                />
                {isSearchOpen ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border/60 bg-card/95 p-2 shadow-lg">
                    {filteredHeadings.length ? (
                      <div className="grid gap-1">
                        {filteredHeadings.map((heading) => (
                          <button
                            key={`${heading.tabId}-${heading.id}`}
                            type="button"
                            onClick={() => handleHeadingSelect(heading)}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted/30"
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
          </div>
        }
      >
        <div className="rules-content" dangerouslySetInnerHTML={{ __html: activeContent.content }} />
      </TabbedCard>
    </div>
  );
}

