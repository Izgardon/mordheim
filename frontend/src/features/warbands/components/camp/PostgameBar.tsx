import { Link } from "react-router-dom";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PHASE_ACTION } from "@/features/battles/utils/open-battles";
import { cn } from "@/lib/utils";

import { upkeepLines } from "./camp-state";
import type { CampRow, CampState } from "./camp-types";

const chip =
  "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border px-2 text-[13px] font-semibold";

/** Which camp steps are done: what the draft's camp record and the upkeep say. */
export function campDone(camp: CampState): Record<CampRow, boolean> {
  const record = camp.draft.camp ?? {};
  return {
    sell: Boolean(record.sold?.length),
    recruit: Boolean(record.recruited?.length),
    hire: false,
    upkeep: upkeepLines(camp).every((line) => line.status !== "due"),
    pacts: false, // a roll is never owed: the rule only lets a 12 through
    buy: camp.bought,
  };
}

const Tick = ({ className }: { className?: string }) => (
  <Check className={cn("h-[13px] w-[13px]", className)} strokeWidth={2.5} aria-label="Done" />
);

/**
 * The web's post-game bar (design E), in the top bar over your warband page (William, 28 Nov
 * 2026): the battle and its result, the Aftermath's three steps linking to the Aftermath, each
 * ticked only once its Next was pressed, camp's steps, which tick when done and jump to their row
 * in camp (Ready opens the confirm), and To the aftermath. One line, the two groups told apart by
 * a rule: the battle's name gives way first, then the steps scroll sideways.
 */
export default function PostgameBar({ camp }: { camp: CampState }) {
  const done = camp.postgame.locks;
  const campTicks = campDone(camp);
  const steps = [
    { tab: "injuries", label: "Injuries", done: done.injuries },
    { tab: "xp", label: "Experience", done: done.xp },
    { tab: "explore", label: "Explore", done: done.explore },
  ];
  const chips: { id: CampRow | "ready"; label: string; done: boolean }[] = [
    { id: "sell", label: "Sell", done: campTicks.sell },
    { id: "recruit", label: "Recruit", done: campTicks.recruit },
    { id: "upkeep", label: "Upkeep", done: campTicks.upkeep },
    { id: "buy", label: "Buy", done: campTicks.buy },
    { id: "ready", label: "Ready", done: false },
  ];

  return (
    <section aria-label="After the battle" className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex min-w-[88px] max-w-[220px] flex-[0_100_auto] flex-col">
        <span className="truncate text-sm font-semibold text-head">{camp.title}</span>
        <span className="truncate text-xs text-text2">{camp.subtitle}</span>
      </div>
      <nav
        aria-label="Post-game steps"
        className="flex min-w-0 flex-auto items-center gap-2.5 overflow-x-auto [scrollbar-width:none]"
      >
        <ol aria-label="Aftermath" className="m-0 flex list-none gap-1 p-0">
          {steps.map((step) => (
            <li key={step.tab}>
              <Link
                to={camp.aftermathPath}
                className={cn(chip, "border-border text-text2 hover:text-ink")}
              >
                {step.done ? <Tick className="text-accent-text" /> : null}
                {step.label}
              </Link>
            </li>
          ))}
        </ol>
        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />
        <ol aria-label="Camp" className="m-0 flex list-none gap-1 p-0">
          {chips.map((entry) => {
            const on = camp.focus === entry.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    camp.setCamp(entry.id);
                    if (entry.id !== "ready")
                      document
                        .getElementById(`camp-row-${entry.id}`)
                        ?.scrollIntoView({ block: "center" });
                  }}
                  className={cn(
                    chip,
                    on
                      ? "border-accent-line bg-accent-soft text-accent-hi"
                      : entry.done
                        ? "border-border text-text2"
                        : "border-border text-muted-foreground"
                  )}
                >
                  {entry.done ? <Tick /> : null}
                  {entry.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <Button asChild size="sm" className="ml-auto h-9 shrink-0 px-2.5 text-[13px]">
        <Link to={camp.aftermathPath}>{PHASE_ACTION.postgame}</Link>
      </Button>
    </section>
  );
}
