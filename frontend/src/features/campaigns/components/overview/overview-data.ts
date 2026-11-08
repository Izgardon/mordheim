import type { GameIconName } from "@/components/ui/game-icons";

import type {
  BattleRecord,
  BattleRecordOut,
  BattleRecordUnit,
  CampaignBattleHistoryEntry,
  CampaignBattleMoment,
  CampaignPlayer,
} from "../../types/campaign-types";

/** Where a player stands between battles (design E's readiness bar). */
export type Readiness = "ready" | "post" | "battle";

export const READINESS_LABEL: Record<Readiness, string> = {
  ready: "Ready",
  post: "Post-game",
  battle: "In battle",
};

/**
 * Ready: no unfinished battle. Post-game: he has finished his fight and his post-game is open.
 * In battle: anything before that (invited, getting ready, fighting).
 */
export function readinessOf(player: CampaignPlayer): Readiness {
  if (!player.battle_busy) return "ready";
  return player.battle_busy_participant_status === "finished_battle" ? "post" : "battle";
}

/** The players who have a warband: the ones the readiness bar and the standings show. */
export const withWarbands = (players: CampaignPlayer[]) =>
  players.filter((player) => player.warband?.id);

/** A standings row: each warband by rating, with its won, drawn and lost battles. */
export type Standing = {
  rank: number;
  playerId: number;
  player: string;
  warbandId: number;
  warband: string;
  /** Its warband type's name. */
  warbandType: string;
  rating: number;
  record: string;
};

/**
 * The standings (design E): every warband by rating. Wins and losses are the warband's own;
 * draws are its ended battles that had no winner (the history has every one of them).
 */
export function buildStandings(
  players: CampaignPlayer[],
  history: CampaignBattleHistoryEntry[]
): Standing[] {
  const draws = new Map<number, number>();
  for (const battle of history) {
    if (battle.winners.length) continue;
    for (const row of battle.participants) {
      draws.set(row.warband_id, (draws.get(row.warband_id) ?? 0) + 1);
    }
  }
  return withWarbands(players)
    .map((player) => {
      const warband = player.warband!;
      return {
        rank: 0,
        playerId: player.id,
        player: player.name,
        warbandId: warband.id,
        warband: warband.name,
        warbandType: warband.type_name,
        rating: warband.rating ?? 0,
        record: `${warband.wins ?? 0}–${draws.get(warband.id) ?? 0}–${warband.losses ?? 0}`,
      };
    })
    .sort((a, b) => b.rating - a.rating || a.warband.localeCompare(b.warband))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * The stats line: battles, warbands, kills, the shards exploration found (named as the campaign
 * names its default resource), heroes lost (`short`: a phone's label, "" to leave out), each with
 * its small icon, as the warband's info line has.
 */
export function buildStats(
  players: CampaignPlayer[],
  history: CampaignBattleHistoryEntry[],
  resourceName = "Wyrdstone"
): { k: string; short: string; v: number; icon: GameIconName }[] {
  const rows = history.flatMap((battle) => battle.participants);
  const sum = (value: (row: (typeof rows)[number]) => number | null | undefined) =>
    rows.reduce((total, row) => total + (value(row) ?? 0), 0);
  const shards = sum((row) => row.shards);
  return [
    { k: "Battles", short: "Battles", v: history.length, icon: "battles" },
    { k: "Warbands", short: "", v: withWarbands(players).length, icon: "warbands" },
    { k: "Kills", short: "Kills", v: sum((row) => row.kills), icon: "kills" },
    { k: `${resourceName} found`, short: resourceName, v: shards, icon: "wyrdstone" },
    { k: "Heroes lost", short: "Lost", v: sum((row) => row.heroes_lost), icon: "lost" },
  ];
}

/** "The Grey Lanterns beat The Crimson Hand", "Iron Oath drew with Ashen Crows". */
export function battleLine(battle: CampaignBattleHistoryEntry) {
  const names = battle.participants.map((row) => row.warband_name);
  if (!battle.winners.length) {
    return {
      first: names.slice(0, 1).join(""),
      verb: "drew with",
      second: names.slice(1).join(", "),
    };
  }
  const losers = names.filter((name) => !battle.winners.includes(name));
  return {
    first: battle.winners.join(", "),
    verb: losers.length ? "beat" : "won",
    second: losers.join(", "),
  };
}

/**
 * A battle's pivotal moments grouped as its row shows them, in the server's fight order by their
 * tag: "Turn 1", "Turn 2" and on, "During" for a kill logged after the fight, then "Result".
 */
export function momentGroups(moments: CampaignBattleMoment[] = []) {
  const labels = [...new Set(moments.map((moment) => moment.tag))];
  return labels
    .map((label) => ({ label, moments: moments.filter((moment) => moment.tag === label) }))
    .filter((group) => group.moments.length > 0);
}

/**
 * A moment's detail split around its unit's name, so the row can link the name to the unit's
 * card; null when it has no unit or its name isn't in the detail.
 */
export function momentParts(moment: CampaignBattleMoment) {
  const name = moment.unit?.name ?? "";
  const at = name ? moment.detail.indexOf(name) : -1;
  if (at < 0) return null;
  return {
    before: moment.detail.slice(0, at),
    name,
    after: moment.detail.slice(at + name.length),
  };
}

/** One group of an open battle's record: its turn's units out of action and moments, or the After. */
export type RecordGroup = {
  label: string;
  outs: BattleRecordOut[];
  moments: CampaignBattleMoment[];
  aftermath: BattleRecord["aftermath"];
};

/**
 * The Battles page's open battle (William, 7 Nov 2026: "battles: just do put out of action, can
 * then also show what happened to units in that battle after if they got injuries or died"): each
 * turn's units put out of action, then its pivotal moments; the moments from kills logged after
 * the fight ("During"); then After, each warband's injuries and deaths and the result moments.
 */
export function recordGroups(record: BattleRecord, moments: CampaignBattleMoment[] = []) {
  const turns = new Map<number, RecordGroup>();
  const turn = (round: number) => {
    const found = turns.get(round) ?? {
      label: `Turn ${round}`,
      outs: [],
      moments: [],
      aftermath: [],
    };
    turns.set(round, found);
    return found;
  };
  for (const { round, out_of_action } of record.rounds) turn(round).outs.push(...out_of_action);
  for (const moment of moments) if (moment.round) turn(moment.round).moments.push(moment);
  const during = moments.filter((moment) => !moment.round && moment.tag === "During");
  const results = moments.filter((moment) => !moment.round && moment.tag !== "During");
  const groups = [...turns.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
  if (during.length) groups.push({ label: "During", outs: [], moments: during, aftermath: [] });
  if (record.aftermath.length || results.length) {
    groups.push({ label: "After", outs: [], moments: results, aftermath: record.aftermath });
  }
  return groups;
}

/** What the Aftermath did to a unit: its results in order, "Dead" added when none says it. */
export function aftermathText(unit: BattleRecordUnit) {
  const results =
    unit.dead && !unit.results.includes("Dead") ? [...unit.results, "Dead"] : unit.results;
  return results.join(", ");
}
