import type { BattleStatus } from "@/features/battles/types/battle-types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const timeOf = (value?: string | null) => {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : null;
};

/** "idle 6 days" or "idle 3 hours" since a battle's last write; nothing under an hour (BUG-10). */
export function idleLabel(lastActivityAt?: string | null, now = Date.now()) {
  const last = timeOf(lastActivityAt);
  if (last === null) {
    return null;
  }
  const idle = now - last;
  if (idle >= DAY_MS) {
    return `idle ${plural(Math.floor(idle / DAY_MS), "day")}`;
  }
  if (idle >= HOUR_MS) {
    return `idle ${plural(Math.floor(idle / HOUR_MS), "hour")}`;
  }
  return null;
}

type DeadlineBattle = {
  status: BattleStatus;
  closes_at?: string | null;
  overdue?: boolean;
};

/**
 * When an unanswered invite or an unfinished postbattle closes (decision 2): "Invites close in
 * 2 days", "Postbattle closes in 5 hours", or "Overdue" once it is past (settled on the next read).
 * `short` drops the phase ("closes in 2 days") for lists that show it already.
 */
export function deadlineLabel(
  battle: DeadlineBattle,
  { now = Date.now(), short = false }: { now?: number; short?: boolean } = {}
) {
  const closes = timeOf(battle.closes_at);
  if (battle.overdue || (closes !== null && closes <= now)) {
    return "Overdue";
  }
  if (closes === null) {
    return null;
  }
  const left = closes - now;
  const when =
    left >= DAY_MS
      ? `in ${plural(Math.floor(left / DAY_MS), "day")}`
      : left >= HOUR_MS
        ? `in ${plural(Math.floor(left / HOUR_MS), "hour")}`
        : "within the hour";
  if (short) {
    return `closes ${when}`;
  }
  return battle.status === "inviting" ? `Invites close ${when}` : `Postbattle closes ${when}`;
}
