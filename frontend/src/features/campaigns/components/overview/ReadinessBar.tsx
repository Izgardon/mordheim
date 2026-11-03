import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import type { CampaignPlayer } from "../../types/campaign-types";
import { READINESS_LABEL, readinessOf, withWarbands, type Readiness } from "./overview-data";

const DOT: Record<Readiness, string> = {
  ready: "bg-good",
  post: "bg-primary",
  battle: "bg-danger",
};
/** "In battle 6", "Post-game · Battle 6", "Ready": the busy battle's number when it has one. */
const chipLabel = (player: CampaignPlayer, state: Readiness) => {
  const number = player.battle_busy_battle_number;
  if (!number || state === "ready") return READINESS_LABEL[state];
  return state === "battle"
    ? `In battle ${number}`
    : `${READINESS_LABEL[state]} · Battle ${number}`;
};
const TEXT: Record<Readiness, string> = {
  ready: "text-good",
  post: "text-accent-text",
  battle: "text-danger",
};

/**
 * Who is ready for the next battle (design E): each player with a warband and his state (Ready,
 * Post-game, In battle), yours picked out. The overview's web bar holds it (William: the
 * overview's priority stays Between battles, even while you are in a battle), one row that scrolls
 * sideways past the bar's end, a mouse wheel too (William: "what happens if more players, does
 * it side scroll?"); a row that scrolls sideways at the top of the page on a phone.
 */
export default function ReadinessBar({
  players,
  userId,
  isMobile,
}: {
  players: CampaignPlayer[];
  userId: number | undefined;
  isMobile: boolean;
}) {
  const fielded = withWarbands(players);
  const rowRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    if (!row || isMobile) return;
    const onWheel = (event: WheelEvent) => {
      if (row.scrollWidth <= row.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY))
        return;
      event.preventDefault(); // a trackpad scrolls it already; a wheel's up and down goes sideways here
      row.scrollLeft += event.deltaY;
    };
    row.addEventListener("wheel", onWheel, { passive: false });
    return () => row.removeEventListener("wheel", onWheel);
  }, [isMobile, fielded.length]);
  if (!fielded.length) return null;
  const ready = fielded.filter((player) => readinessOf(player) === "ready").length;
  const heading = `${ready} of ${fielded.length} ready`;
  const chips = (
    <ul
      ref={rowRef}
      className={cn(
        "m-0 flex list-none gap-1.5 p-0",
        isMobile
          ? "-mx-3 overflow-x-auto px-3 pb-0.5"
          : // one row in the bar; past its end it scrolls, its right edge fading to say so
            "scrollbar-hidden min-w-0 flex-1 overflow-x-auto pr-8 [mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)]"
      )}
    >
      {fielded.map((player) => {
        const state = readinessOf(player);
        const you = player.id === userId;
        return (
          <li
            key={player.id}
            className={cn(
              "flex min-h-[34px] shrink-0 items-center gap-2 border px-2.5",
              you ? "border-accent-line bg-raised" : "border-border bg-surface"
            )}
          >
            <span aria-hidden="true" className={cn("h-[7px] w-[7px]", DOT[state])} />
            <span className="text-[13px] font-semibold text-ink">{you ? "You" : player.name}</span>
            <span className={cn("text-xs", TEXT[state])}>{chipLabel(player, state)}</span>
          </li>
        );
      })}
    </ul>
  );

  if (isMobile) {
    return (
      <section aria-label="Who is ready" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">
            Between battles
          </span>
          <span className="font-display text-[17px] font-semibold text-head">{heading}</span>
        </div>
        {chips}
      </section>
    );
  }
  // the web bar is one height on every page (William): heading on one line, the chips one row
  return (
    <section aria-label="Who is ready" className="flex min-w-0 flex-1 items-center gap-x-6">
      <div className="flex shrink-0 items-baseline gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-text">
          Between battles
        </span>
        <span className="whitespace-nowrap font-display text-xl font-semibold text-head">
          {heading}
        </span>
      </div>
      {chips}
    </section>
  );
}
