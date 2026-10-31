import { Link } from "react-router-dom";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { aftermathDone, upkeepLines } from "./camp-state";
import type { CampRow, OpenCamp } from "./camp-types";

const label = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/** Which camp steps are done: what the draft's camp record and the upkeep say. */
export function campDone(camp: OpenCamp): Record<CampRow, boolean> {
  const record = camp.draft.camp ?? {};
  return {
    sell: Boolean(record.sold?.length),
    recruit: Boolean(record.recruited?.length),
    hire: false,
    upkeep: upkeepLines(camp).every((line) => line.status !== "due"),
    buy: camp.bought,
  };
}

/**
 * The web's post-game bar (design E), above the warband page: the battle, the Aftermath's three
 * steps (each ticked once done) linking to the Aftermath, and camp's steps, which tick when done
 * and jump to their row in camp; Ready opens the confirm.
 */
export default function PostgameBar({ camp }: { camp: OpenCamp }) {
  const done = aftermathDone(camp);
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
    <section
      aria-label="After the battle"
      className="page-band flex flex-wrap items-center gap-x-8 gap-y-2.5 border-b border-line bg-bar py-3"
    >
      <div className="flex min-w-[180px] flex-col gap-px">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-text">
          After the battle
        </span>
        <span className="text-[13px] text-text2">{camp.subtitle}</span>
      </div>
      <nav
        aria-label="Post-game steps"
        className="flex flex-[1_1_640px] flex-wrap items-center gap-x-5 gap-y-2"
      >
        <div className="flex items-center gap-2.5">
          <span className={label}>Aftermath</span>
          <ol className="m-0 flex list-none gap-1.5 p-0">
            {steps.map((step) => (
              <li key={step.tab}>
                <Link
                  to={camp.aftermathPath}
                  className="flex min-h-9 items-center gap-[7px] border border-border px-3 text-[13px] font-semibold text-text2 hover:text-ink"
                >
                  {step.done ? (
                    <Check
                      className="h-[13px] w-[13px] text-accent-text"
                      strokeWidth={2.5}
                      aria-label="Done"
                    />
                  ) : null}
                  {step.label}
                </Link>
              </li>
            ))}
          </ol>
        </div>
        <span aria-hidden="true" className="h-7 w-px bg-border" />
        <div className="flex items-center gap-2.5">
          <span className={label}>Camp</span>
          <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {chips.map((chip) => {
              const on = camp.focus === chip.id;
              return (
                <li key={chip.id}>
                  <button
                    type="button"
                    onClick={() => {
                      camp.setCamp(chip.id);
                      if (chip.id !== "ready")
                        document
                          .getElementById(`camp-row-${chip.id}`)
                          ?.scrollIntoView({ block: "center" });
                    }}
                    className={cn(
                      "flex min-h-9 items-center gap-[7px] border px-3 text-[13px] font-semibold",
                      on
                        ? "border-accent-line bg-accent-soft text-accent-hi"
                        : chip.done
                          ? "border-border text-text2"
                          : "border-border text-muted-foreground"
                    )}
                  >
                    {chip.done ? (
                      <Check className="h-[13px] w-[13px]" strokeWidth={2.5} aria-label="Done" />
                    ) : null}
                    {chip.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </section>
  );
}
