import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { CriticalHitTable } from "@/features/battles/data/critical-hits";
import { cn } from "@/lib/utils";

export const CRIT_TABLES_OPEN_KEY = "mordheim_crit_tables_open";

/** The tables this device left open; storage that can't be read means none. */
function readOpen(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(CRIT_TABLES_OPEN_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Keeps them for this device; storage failing only loses the memory of it. */
function storeOpen(ids: string[]) {
  try {
    window.localStorage.setItem(CRIT_TABLES_OPEN_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or full storage: the tables stay as they are while the page is open.
  }
}

/**
 * The critical hit tables under Melee and Ranged, each minimised (William, 12 Nov 2026), so the
 * to-hit, to-wound and save numbers sit at the top of the sheet. A table opened stays open on
 * this device, for the weapon in hand all fight. Ranged's Misfire chart is one more of them.
 */
export default function CriticalTables({ tables }: { tables: CriticalHitTable[] }) {
  const [open, setOpen] = useState(readOpen);
  const toggle = (id: string) => {
    const next = open.includes(id) ? open.filter((entry) => entry !== id) : [...open, id];
    setOpen(next);
    storeOpen(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {tables.map((table) => {
        const isOpen = open.includes(table.id);
        return (
          <section
            key={table.id}
            aria-label={table.label}
            className={cn(
              "flex flex-col border bg-surface",
              isOpen ? "border-accent-line" : "border-border"
            )}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(table.id)}
              className="flex min-h-11 items-center justify-between gap-2.5 px-3 text-left"
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
                {table.heading ?? `Critical hits · ${table.label}`}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
            {isOpen ? (
              <dl className="m-0 flex flex-col px-3 pb-2">
                {table.entries.map((entry) => (
                  <div
                    key={entry.roll}
                    className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 border-t border-line py-2"
                  >
                    <dt className="font-mono text-sm font-bold text-accent-text">{entry.roll}</dt>
                    <dd className="m-0 text-sm text-text2">{entry.result}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
