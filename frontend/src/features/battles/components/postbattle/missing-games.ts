import type { PostbattleRenderableRow } from "@/features/battles/components/postbattle/postbattle-utils";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type {
  BattlePostbattleMissingGames,
  BattlePostbattleState,
} from "@/features/battles/types/battle-types";

/**
 * Missing games in postbattle. Finalise counts one game off every missing unit of the warband
 * (brought or not), then sets the missing games a hero's or hired sword's injury offers, when the
 * player ticks the offer (`unit_results[key].missing_games`, replacing any count left).
 */

const plural = (count: number, word: string) => `${word}${count === 1 ? "" : "s"}`;
const gamesText = (games: number) => `${games} ${plural(games, "game")}`;

/**
 * What the unit's last serious-injury roll offers as missing games (the server's table: Deep
 * Wound, Captured, Smashed Leg...), for a hero or hired sword still alive; null otherwise.
 */
export function missingGamesOffer(row: PostbattleRenderableRow) {
  const roll = row.seriousInjuryRolls[row.seriousInjuryRolls.length - 1];
  const misses = roll?.effect?.misses;
  if (!misses || row.unitKind === "henchman" || row.dead) {
    return null;
  }
  return { games: misses.games, dice: misses.dice ?? null, reason: roll.result_label };
}

/** The draft with the unit's missing games set at finalise, or taken off (null). */
export function withMissingGames(
  draft: BattlePostbattleState,
  unitKey: string,
  missing: BattlePostbattleMissingGames | null
): BattlePostbattleState {
  const current = draft.unit_results[unitKey];
  if (!current) {
    return draft;
  }
  const { missing_games: _previous, ...rest } = current;
  const next = missing ? { ...rest, missing_games: missing } : rest;
  return { ...draft, unit_results: { ...draft.unit_results, [unitKey]: next } };
}

type MissingLine = { key: string; text: string };

/**
 * The finalise summary's missing games: each missing unit's game counted off (from the battle
 * roster), then each injury's new count, which replaces the unit's countdown line. A unit that
 * dies here or has left the warband gets neither.
 */
export function buildMissingGames(
  rows: PostbattleRenderableRow[],
  roster: ParticipantRoster | undefined,
  stays: (unitKey: string) => boolean
): MissingLine[] {
  const dead = new Set(rows.filter((row) => row.dead).map((row) => row.unitKey));
  const set = rows.filter(
    (row) => row.missingGames && !row.dead && row.unitKind !== "henchman" && stays(row.unitKey)
  );
  const setKeys = new Set(set.map((row) => row.unitKey));
  const countdown = [
    ...[...(roster?.heroes ?? []), ...(roster?.hirelings ?? [])].map((unit) => ({
      key: unit.key,
      name: unit.displayName,
      games: unit.missingGames ?? 0,
      out: dead.has(unit.key) || setKeys.has(unit.key) || !stays(unit.key),
    })),
    ...(roster?.henchmenGroups ?? []).map((group) => ({
      key: `group:${group.id}`,
      name: group.name,
      games: group.missingGames ?? 0,
      out: group.members.every((member) => dead.has(member.key)),
    })),
  ];
  return [
    ...countdown
      .filter((unit) => unit.games > 0 && !unit.out)
      .map((unit) => ({
        key: `countdown-${unit.key}`,
        text:
          unit.games === 1
            ? `${unit.name} is back after this battle.`
            : `${unit.name} has ${unit.games - 1} more ${plural(unit.games - 1, "game")} to miss after this battle.`,
      })),
    ...set.map((row) => {
      const { games, reason } = row.missingGames as BattlePostbattleMissingGames;
      return {
        key: `set-${row.unitKey}`,
        text: `${row.unitName} will miss the next ${gamesText(games)}${reason ? `: ${reason}` : ""}.`,
      };
    }),
  ];
}
