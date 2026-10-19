import type {
  BattleParticipantStatus,
  BattleStatus,
  BattleSummary,
} from "@/features/battles/types/battle-types";

/**
 * Which battle page shows what (IMP-51): one place decides between loading, an error, a redirect
 * to the page the battle is on now, and the page itself. `BattleLayout` runs it for every page.
 *
 *   inviting   → stays on the page it was opened on (prebattle shows the invite gate)
 *   prebattle  → /prebattle
 *   active     → /active, or /postbattle once you have finished your own fight (decision 4)
 *   postbattle → /postbattle
 *   ended, canceled → the campaign overview
 */

export type BattlePhase = "prebattle" | "active" | "postbattle";

export const BATTLE_PHASES: readonly BattlePhase[] = ["prebattle", "active", "postbattle"];

export type BattleView =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "redirect"; to: BattlePhase | "overview" }
  | { kind: "ready" };

const PAGE_COPY: Record<BattlePhase, { loading: string; error: string }> = {
  prebattle: { loading: "Loading prebattle...", error: "Unable to load prebattle." },
  active: { loading: "Loading battle...", error: "Unable to load battle." },
  postbattle: { loading: "Loading postbattle...", error: "Unable to load postbattle." },
};

/** The battle page a URL is on (its last segment), or null for any other path. */
export function phaseFromPath(pathname: string): BattlePhase | null {
  const last = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  return (BATTLE_PHASES as readonly string[]).includes(last) ? (last as BattlePhase) : null;
}

/** Your fight is over: your postbattle is open while the others may still be fighting. */
const DONE_FIGHTING: readonly BattleParticipantStatus[] = [
  "finished_battle",
  "confirmed_postbattle",
];

/**
 * Where a battle in `status` belongs for a player in `participantStatus`, or null when any page may
 * show it (an invitation, a reported result).
 */
export function pageForStatus(
  status: BattleStatus,
  participantStatus?: BattleParticipantStatus
): BattlePhase | "overview" | null {
  switch (status) {
    case "active":
      return participantStatus && DONE_FIGHTING.includes(participantStatus)
        ? "postbattle"
        : "active";
    case "prebattle":
    case "postbattle":
      return status;
    case "ended":
    case "canceled":
      return "overview";
    default:
      return null;
  }
}

export function deriveBattleView({
  page,
  isLoading,
  error,
  battle,
  participantStatus,
}: {
  page: BattlePhase;
  isLoading: boolean;
  error: string;
  battle: BattleSummary | null | undefined;
  /** Yours, when you are a participant. */
  participantStatus?: BattleParticipantStatus;
}): BattleView {
  if (isLoading) {
    return { kind: "loading", message: PAGE_COPY[page].loading };
  }
  if (error || !battle) {
    return { kind: "error", message: error || PAGE_COPY[page].error };
  }
  const target = pageForStatus(battle.status, participantStatus);
  if (target && target !== page) {
    return { kind: "redirect", to: target };
  }
  return { kind: "ready" };
}

/** The path a redirect goes to. */
export function battleViewPath(to: BattlePhase | "overview", campaignId: number, battleId: number) {
  return to === "overview"
    ? `/campaigns/${campaignId}`
    : `/campaigns/${campaignId}/battles/${battleId}/${to}`;
}
