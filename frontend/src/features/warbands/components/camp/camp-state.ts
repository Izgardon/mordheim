import { injuryRows } from "@/features/battles/components/aftermath/aftermath-injuries";
import { buildXpRows, xpBlock } from "@/features/battles/components/aftermath/aftermath-xp";
import type { BattlePostbattleState } from "@/features/battles/types/battle-types";

import type { OpenCamp } from "./camp-types";

const idOf = (unitKey: string) => Number(unitKey.split(":")[1]);

/** Each hired sword's upkeep at camp: due, paid (a tick), or gone (let go, or dismissed since). */
export function upkeepLines(camp: OpenCamp) {
  return Object.entries(camp.draft.upkeep.entries)
    .filter(([key]) => !camp.draft.unit_results[key]?.dead)
    .map(([key, entry]) => {
      const sword = camp.hirelings.find((unit) => unit.id === idOf(key));
      const status = !sword ? "gone" : entry.paid ? "paid" : "due";
      return { key, id: idOf(key), name: entry.unit_name, cost: entry.cost ?? 0, status };
    });
}

/** What Ready charges in upkeep: every hired sword still on the roster, ticked or not. */
export const upkeepCharged = (camp: OpenCamp) =>
  upkeepLines(camp)
    .filter((line) => line.status !== "gone")
    .reduce((sum, line) => sum + line.cost, 0);

/** Whether each Aftermath tab is done: every roll made, every advance taken, the dice rolled. */
export function aftermathDone(camp: OpenCamp) {
  const { draft, postgame, battleState, campaign } = camp;
  const mounts = Object.keys(battleState.suggested_postbattle?.mount_survival?.entries ?? {});
  const injuries =
    injuryRows(draft, undefined).every((row) => row.seriousInjuryRolls.length > 0) &&
    mounts.every((key) => (draft.mount_survival?.[key]?.roll ?? null) !== null);
  const xp = buildXpRows(draft, postgame.sheet, campaign, battleState.suggested_postbattle).every(
    (row) => !row.canGainXp || !xpBlock(row).canAdvance
  );
  const dice = postgame.explore.exploration?.diceValues ?? [];
  const explore = dice.length === 0 || dice.every((value) => value !== null);
  return { injuries, xp, explore };
}

const last = <T>(list: T[]) => list[list.length - 1];

/** The Ready confirm's headline results (design E): deaths, advances, injuries, gold, shards. */
export function readySummary(camp: OpenCamp) {
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
  const injuries = results
    .filter((r) => !r.dead && r.serious_injury_rolls.length)
    .map((r) => {
      const roll = last(r.serious_injury_rolls);
      const games = r.missing_games?.games;
      return `${r.unit_name}: ${roll.result_label}${games ? `, misses ${games} game${games === 1 ? "" : "s"}` : ""}`;
    });
  const finds = draft.finds.gold_crowns;
  const after = camp.gold - upkeepCharged(camp) + finds;
  const { amount, resource } = camp.postgame.explore;
  return [
    { k: "Deaths", v: deaths.join(", ") || "None" },
    { k: "Advances", v: advances.join(" · ") || "None" },
    { k: "Injuries", v: injuries.join(" · ") || "None" },
    { k: "Gold", v: `${camp.gold} → ${after} gc` },
    {
      k: "Shards",
      v: resource ? `+${amount} ${resource.name}, now ${resource.amount + amount}` : `+${amount}`,
    },
  ];
}
