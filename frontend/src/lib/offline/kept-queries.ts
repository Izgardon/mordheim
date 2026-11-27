import type { Query, QueryCache, QueryKey } from "@tanstack/react-query";
import { defaultShouldDehydrateQuery } from "@tanstack/react-query";

import type { BattleState } from "@/features/battles/types/battle-types";

/**
 * The reads this phone keeps for the table (docs/plans/offline.md, phase 1): what a player reads
 * with weak or no signal. Everything else stays in memory only, above all what holds other
 * players' private data (members' emails, chat, trades, bounty targets), the previews behind a
 * confirm button, and what is large and no use offline (search, history, logs, archived lists).
 */

/** How long a kept read lives, on the phone and in memory: a week. */
export const KEPT_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

const ANY_ID = Symbol("id");
type Segment = string | typeof ANY_ID;

/** Keys outside a campaign, matched whole. */
const TOP_LEVEL: readonly string[] = ["campaigns", "settings"];

/** Keys under `["campaign", id, ...]`, matched whole (`ANY_ID`: any number; `"*"`: any string). */
const IN_CAMPAIGN: readonly (readonly Segment[])[] = [
  ["detail"],
  ["players"],
  ["campaign-rules"],
  ["campaign-charts"],
  ["rules"],
  ["battle-rules"],
  ["scenarios"],
  ["scenario-catalogue", ANY_ID],
  ["locations"],
  ["encampments"],
  ["exploration"],
  ["warband-templates"],
  ["warband-templates", ANY_ID],
  ["catalogue", "*"],
  ["catalogue-entry", "*", ANY_ID],
  ["battles", "open"],
  ["warband", "mine"],
  ["warband", ANY_ID, "sheet"],
  ["warband", ANY_ID, "rules"],
  ["warband", ANY_ID, "stash"],
  // What it can usually buy: the reference pages' "What <warband> can buy" waits for it.
  ["warband", ANY_ID, "who-can"],
  ["battle", ANY_ID, "state"],
  ["battle", ANY_ID, "rosters"],
];

function segmentMatches(value: unknown, segment: Segment) {
  if (segment === ANY_ID) return typeof value === "number";
  if (segment === "*") return typeof value === "string";
  return value === segment;
}

/** Whether a query of this key is kept on the phone. */
export function isKeptQueryKey(queryKey: QueryKey) {
  if (queryKey.length === 1 && TOP_LEVEL.includes(queryKey[0] as string)) {
    return true;
  }
  if (queryKey[0] !== "campaign" || typeof queryKey[1] !== "number") {
    return false;
  }
  const rest = queryKey.slice(2);
  return IN_CAMPAIGN.some(
    (pattern) =>
      pattern.length === rest.length &&
      pattern.every((segment, index) => segmentMatches(rest[index], segment))
  );
}

const OVER: readonly string[] = ["ended", "canceled"];

/** A battle that is over is the Battles page's to show: its state and rosters aren't kept. */
function isBattleOver(query: Query, queryCache: QueryCache) {
  if (query.queryKey[2] !== "battle") return false;
  const stateKey = [...query.queryKey.slice(0, 4), "state"];
  const state = queryCache.find<BattleState>({ queryKey: stateKey, exact: true })?.state.data;
  return state ? OVER.includes(state.battle.status) : false;
}

/** Whether a query is written to the phone now: kept, read successfully, and under a week old. */
export function shouldKeepQuery(query: Query, queryCache: QueryCache, now = Date.now()) {
  return (
    defaultShouldDehydrateQuery(query) &&
    isKeptQueryKey(query.queryKey) &&
    now - query.state.dataUpdatedAt < KEPT_MAX_AGE_MS &&
    !isBattleOver(query, queryCache)
  );
}

/**
 * Kept reads stay in memory as long as on the phone: a read dropped from memory (after five
 * minutes unused, or at once for a battle's) would be dropped from the phone at the next save.
 * TanStack only ever raises a query's `gcTime`, so raising it as the query is made is enough.
 */
export function keepTableReadsInMemory(queryCache: QueryCache) {
  return queryCache.subscribe((event) => {
    if (event.type === "added" && isKeptQueryKey(event.query.queryKey)) {
      event.query.setOptions({ ...event.query.options, gcTime: KEPT_MAX_AGE_MS });
    }
  });
}
