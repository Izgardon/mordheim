import type {
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

/** The stats line: battles, warbands, kills, shards found, heroes lost (`short`: a phone's label, "" to leave out). */
export function buildStats(players: CampaignPlayer[], history: CampaignBattleHistoryEntry[]) {
  const rows = history.flatMap((battle) => battle.participants);
  const sum = (value: (row: (typeof rows)[number]) => number | null | undefined) =>
    rows.reduce((total, row) => total + (value(row) ?? 0), 0);
  return [
    { k: "Battles", short: "Battles", v: history.length },
    { k: "Warbands", short: "", v: withWarbands(players).length },
    { k: "Kills", short: "Kills", v: sum((row) => row.kills) },
    { k: "Shards found", short: "Shards", v: sum((row) => row.shards) },
    { k: "Heroes lost", short: "Lost", v: sum((row) => row.heroes_lost) },
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
 * tag: "Round 1", "Round 2" and on, "During" for a kill logged after the fight, then "Result".
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
