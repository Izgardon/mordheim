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
 * overview's priority stays Between battles, even while you are in a battle); a row that
 * scrolls sideways at the top of the page on a phone.
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
  if (!fielded.length) return null;
  const ready = fielded.filter((player) => readinessOf(player) === "ready").length;
  const heading = `${ready} of ${fielded.length} ready`;
  const chips = (
    <ul
      className={cn(
        "m-0 flex list-none gap-1.5 p-0",
        isMobile ? "-mx-3 overflow-x-auto px-3 pb-0.5" : "flex-[1_1_560px] flex-wrap"
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
  return (
    <section
      aria-label="Who is ready"
      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-8 gap-y-2 py-1.5"
    >
      <div className="flex min-w-[190px] flex-col gap-px">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-text">
          Between battles
        </span>
        <span className="font-display text-xl font-semibold text-head">{heading}</span>
      </div>
      {chips}
    </section>
  );
}
