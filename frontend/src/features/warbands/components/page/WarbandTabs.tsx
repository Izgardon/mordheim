import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const TABS = ["Roster", "Treasury", "Backstory", "Log"] as const;
export type WarbandTab = (typeof TABS)[number];

/** The warband page's tabs (design E): Roster, Treasury, Backstory and Log, each rendered here. */
export default function WarbandTabs({ render }: { render: (tab: WarbandTab) => ReactNode }) {
  const [tab, setTab] = useState<WarbandTab>("Roster");
  return (
    <>
      <div role="tablist" aria-label="Warband" className="flex gap-7 border-b border-line">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
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
