import { advancesWaiting, buildXpRows } from "@/features/battles/components/aftermath/aftermath-xp";
import type { BattlePostbattleState } from "@/features/battles/types/battle-types";

import type { CampState } from "./camp-types";

const idOf = (unitKey: string) => Number(unitKey.split(":")[1]);

/**
 * Each hired sword's upkeep at camp: due, paid (a tick), or gone (let go, or dismissed since), with
 * the gold and the resource lines the draft holds and his upkeep fee (what pays each resource).
 */
export function upkeepLines(camp: CampState) {
  return Object.entries(camp.draft.upkeep.entries)
    .filter(([key]) => !camp.draft.unit_results[key]?.dead)
    .map(([key, entry]) => {
      const sword = camp.hirelings.find((unit) => unit.id === idOf(key));
      const status = !sword ? "gone" : entry.paid ? "paid" : "due";
      const cost = entry.cost ?? 0;
      return {
        key,
        id: idOf(key),
        name: entry.unit_name,
        cost,
        entry,
        fee: sword?.upkeep_fee,
        status,
      };
    });
}

export type UpkeepLine = ReturnType<typeof upkeepLines>[number];

/** "20 gc and 1 Wyrdstone": what the lines still due ask. */
export function dueText(lines: UpkeepLine[]) {
  const due = lines.filter((line) => line.status === "due");
  const gold = due.reduce((sum, line) => sum + line.cost, 0);
  const kinds = due.flatMap((line) =>
    (line.entry.resources ?? [])
      .filter((resource) => resource.resource_id !== null && resource.amount > 0)
      .map((resource) => `${resource.amount} ${resource.resource}`)
  );
  return [gold || !kinds.length ? `${gold} gc` : "", ...kinds].filter(Boolean).join(" and ");
}

/** What Ready charges in upkeep: every hired sword still on the roster, ticked or not. */
export const upkeepCharged = (camp: CampState) =>
  upkeepLines(camp)
    .filter((line) => line.status !== "gone")
    .reduce((sum, line) => sum + line.cost, 0);

const last = <T>(list: T[]) => list[list.length - 1];

/**
 * The Ready confirm's headline results (design E): deaths, advances (those rolled, and the units
 * with one waiting, which their card offers after Ready: information, never a block), injuries,
 * gold, shards.
 */
export function readySummary(camp: CampState) {
  const draft: BattlePostbattleState = camp.draft;
  const results = Object.values(draft.unit_results);
  const mounts = Object.entries(draft.mount_survival ?? {})
    .filter(([, entry]) => entry.dead)
    .map(([key]) => camp.battleState.suggested_postbattle?.mount_survival?.entries[key]?.mount)
    .filter(Boolean);
  const deaths = [...results.filter((r) => r.dead).map((r) => r.unit_name), ...mounts];
  const seen = new Set<string>();
  const advances = results
    .filter((r) => r.advances?.length)
    .filter((r) => {
      const who = r.unit_kind === "henchman" ? r.group_name : r.unit_name;
      if (seen.has(who)) return false;
      seen.add(who);
      return true;
    })
    .map(
      (r) =>
        `${r.unit_kind === "henchman" ? r.group_name : r.unit_name}: ${r.advances!.map((a) => a.label).join(", ")}`
    );
  const waiting = buildXpRows(
    draft,
    camp.postgame.sheet,
    camp.campaign,
    camp.battleState.suggested_postbattle
  ).flatMap((row) => {
    const count = advancesWaiting(row);
    if (!count) return [];
    return [`${row.name}: ${count === 1 ? "advance" : `${count} advances`} waiting`];
  });
  const injuries = results
    .filter((r) => !r.dead && r.serious_injury_rolls.length)
    .map((r) => {
      const roll = last(r.serious_injury_rolls);
      const games = r.missing_games?.games;
      const mutation = roll.mutation?.special ? ` (${roll.mutation.special})` : "";
      return `${r.unit_name}: ${roll.result_label}${mutation}${games ? `, misses ${games} game${games === 1 ? "" : "s"}` : ""}`;
    });
  // once the explore step has handed its shards and finds over, the warband already holds them
  const handedOver = camp.postgame.locks.explore;
  const finds = handedOver ? 0 : draft.finds.gold_crowns;
  const after = camp.gold - upkeepCharged(camp) + finds;
  const { amount, resource } = camp.postgame.explore;
  const shardsNow = resource ? resource.amount + (handedOver ? 0 : amount) : 0;
  const inKind = upkeepLines(camp)
    .filter((line) => line.status !== "gone")
    .flatMap((line) => line.entry.resources ?? [])
    .filter((line) => line.resource_id !== null && line.amount > 0)
    .map((line) => `${line.amount} ${line.resource}`);
  return [
    { k: "Deaths", v: deaths.join(", ") || "None" },
    { k: "Advances", v: [...advances, ...waiting].join(" · ") || "None" },
    { k: "Injuries", v: injuries.join(" · ") || "None" },
    { k: "Gold", v: `${camp.gold} → ${after} gc` },
    ...(inKind.length ? [{ k: "Upkeep", v: inKind.join(", ") }] : []),
    {
      k: "Shards",
      v: resource ? `+${amount} ${resource.name}, now ${shardsNow}` : `+${amount}`,
    },
  ];
}
