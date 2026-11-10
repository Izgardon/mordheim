import { useState, type ReactNode } from "react";

import { useTabScroll } from "@/lib/use-tab-scroll";
import { cn } from "@/lib/utils";

const TABS = ["Roster", "Treasury", "Backstory", "Log"] as const;
export type WarbandTab = (typeof TABS)[number];

/**
 * The warband page's tabs (design E): Roster, Treasury, Backstory and Log, each rendered here. A
 * tab change keeps the tab bar at the top of the screen, never the page's top (`useTabScroll`).
 */
export default function WarbandTabs({ render }: { render: (tab: WarbandTab) => ReactNode }) {
  const [tab, setTab] = useState<WarbandTab>("Roster");
  const tabs = useTabScroll();
  return (
    <>
      <div
        ref={tabs.barRef}
        role="tablist"
        aria-label="Warband"
        className="flex gap-7 border-b border-line"
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => {
              tabs.pick();
              setTab(name);
            }}
            className={cn(
              "-mb-px border-b-2 py-2.5 text-sm font-semibold",
              tab === name
                ? "border-primary text-head"
                : "border-transparent text-faint hover:text-text2"
            )}
          >
            {name}
          </button>
        ))}
      </div>
      {render(tab)}
    </>
  );
}
