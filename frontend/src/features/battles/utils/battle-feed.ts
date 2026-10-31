import type {
  ParticipantRoster,
  PrebattleUnit,
} from "@/features/battles/components/prebattle/prebattle-types";
import { normalizeCustomUnits } from "@/features/battles/components/prebattle/prebattle-utils";
import type { BattleEvent, BattleParticipant } from "@/features/battles/types/battle-types";

/** One line of the battle feed: the round it fell in, the words, and whether it was a kill. */
export type FeedLine = {
  id: number;
  round: number;
  text: string;
  kill: boolean;
  /** Undone: the line stays, struck through (BUG-11). */
  voided: boolean;
  /** Your own kill or item use, which you can still undo. */
  undoable: boolean;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const STAMPED = new Set<BattleEvent["type"]>([
  "unit_kill_recorded",
  "unit_ooa_set",
  "unit_ooa_unset",
  "neutral_ooa_set",
  "neutral_group_added",
]);

function rosterUnits(roster: ParticipantRoster | undefined): PrebattleUnit[] {
  return [
    ...(roster?.heroes ?? []),
    ...(roster?.hirelings ?? []),
    ...(roster?.henchmenGroups ?? []).flatMap((group) => group.members),
    ...(roster?.petModels ?? []),
  ];
}

/**
 * The battle's timeline in plain words, oldest first, each line under the round it
 * happened in: the start, kills ("Ulrich took a Darksoul out of action · melee"), models out of
 * action and back, items used, the rounds asked for and started, neutral creatures, and players
 * finishing. Everything else (invites, readies) stays out of it.
 */
export function battleFeed(
  events: BattleEvent[],
  participants: BattleParticipant[],
  rosters: Record<number, ParticipantRoster | undefined>,
  userId: number | undefined
): FeedLine[] {
  const player = (id: number | null) =>
    id === null
      ? "Someone"
      : (participants.find((entry) => entry.user.id === id)?.user.label ?? "Someone");
  const unitName = (warbandId: unknown, unitKey: unknown) => {
    const owner = participants.find((entry) => entry.warband.id === warbandId);
    if (!owner) return "A model";
    const unit = [
      ...rosterUnits(rosters[owner.user.id]),
      ...normalizeCustomUnits(owner.custom_units_json),
    ].find((entry) => entry.key === unitKey);
    return unit?.displayName ?? "A model";
  };
  const who = (unit: { name?: unknown; type_name?: unknown } | undefined, start: boolean) => {
    const name = text(unit?.name);
    if (name) return name;
    const kind = text(unit?.type_name);
    const phrase = kind ? `a ${kind}` : "someone";
    return start ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase;
  };

  let round = 1;
  const lines: FeedLine[] = [];
  for (const event of events) {
    const payload = event.payload_json as Record<string, unknown>;
    // Kills and out-of-action events carry the round they happened in; a round ask names the next.
    const at = STAMPED.has(event.type) && typeof payload.round === "number" ? payload.round : round;
    const own = event.actor_user_id === userId;
    const line = (words: string, kill = false, undoable = false) =>
      lines.push({
        id: event.id,
        round: at,
        text: words,
        kill,
        voided: Boolean(event.voided_at),
        undoable: undoable && own && !event.voided_at,
      });
    switch (event.type) {
      case "battle_started":
        line("Battle started");
        break;
      case "unit_kill_recorded": {
        const kill = event.payload_json;
        const how = text(kill.how);
        const extra = [how, kill.earned_xp === false ? "no XP" : ""].filter(Boolean);
        const words = `${who(kill.killer, true)} took ${who(kill.victim, false)} out of action`;
        line([words, ...extra].join(" · "), true, true);
        break;
      }
      case "unit_ooa_set":
      case "unit_ooa_unset": {
        const unit = (payload.unit ?? {}) as Record<string, unknown>;
        const name = unitName(unit.warband_id, unit.unit_key);
        line(event.type === "unit_ooa_set" ? `${name} is out of action` : `${name} is back up`);
        break;
      }
      case "neutral_ooa_set": {
        const neutral = (payload.neutral ?? {}) as Record<string, unknown>;
        const name = text(neutral.name) || "A creature";
        line(payload.out_of_action ? `${name} is out of action` : `${name} is back up`);
        break;
      }
      case "item_used":
        line(
          `${unitName(
            participants.find((entry) => entry.user.id === event.actor_user_id)?.warband.id,
            event.payload_json.unit_key
          )} used ${text(event.payload_json.item_name) || "an item"}`,
          false,
          true
        );
        break;
      case "round_requested":
        line(`${player(event.actor_user_id)} asked for round ${payload.round}`);
        break;
      case "round_agreed":
        line(`${player(event.actor_user_id)} agreed to round ${payload.round}`);
        break;
      case "round_request_withdrawn":
        line(`${player(event.actor_user_id)} took back the ask for round ${payload.round}`);
        break;
      case "round_started":
        round = typeof payload.round === "number" ? payload.round : round + 1;
        lines.push({
          id: event.id,
          round,
          text: payload.forced
            ? `Round ${round} began. ${player(event.actor_user_id)} started it.`
            : `Round ${round} began. Everyone agreed.`,
          kill: false,
          voided: false,
          undoable: false,
        });
        break;
      case "neutral_group_added": {
        const count = Number(payload.count) || 1;
        line(
          `${text(payload.name) || "Creatures"} joined the fight${count > 1 ? ` (${count})` : ""}`
        );
        break;
      }
      case "neutral_creature_added":
        line(`${text(payload.name) || "A creature"} joined the fight`);
        break;
      case "participant_finished_battle":
        line(`${player(event.actor_user_id)} finished his battle`);
        break;
      default:
        break;
    }
  }
  return lines;
}
