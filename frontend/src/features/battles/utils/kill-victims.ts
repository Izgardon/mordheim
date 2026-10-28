import type {
  ParticipantRoster,
  PrebattleUnit,
} from "@/features/battles/components/prebattle/prebattle-types";
import { normalizeCustomUnits } from "@/features/battles/components/prebattle/prebattle-utils";
import type { BattleEvent, BattleParticipant } from "@/features/battles/types/battle-types";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function rosterUnits(roster: ParticipantRoster | undefined): PrebattleUnit[] {
  return [
    ...(roster?.heroes ?? []),
    ...(roster?.hirelings ?? []),
    ...(roster?.henchmenGroups ?? []).flatMap((group) => group.members),
    ...(roster?.petModels ?? []),
  ];
}

/**
 * Who a kill took out, as postbattle lists it (BATL-NEW-06): "Player's Black Fang" for a unit of
 * another warband (its name from the event, else from that player's roster), or the name typed
 * for a unit that isn't on any roster.
 */
export function killVictimName(
  event: BattleEvent,
  participants: BattleParticipant[],
  rosters: Record<number, ParticipantRoster | undefined>
) {
  const victim = event.type === "unit_kill_recorded" ? event.payload_json?.victim : undefined;
  const unitKey = text(victim?.unit_key);
  const owner = participants.find((participant) => participant.warband.id === victim?.warband_id);
  const fromRoster = owner
    ? [
        ...rosterUnits(rosters[owner.user.id]),
        ...normalizeCustomUnits(owner.custom_units_json),
      ].find((unit) => unit.key === unitKey)?.displayName
    : undefined;
  const name = text(victim?.name) || text(fromRoster);
  if (!name) {
    return "an unnamed enemy";
  }
  return unitKey && owner ? `${owner.user.label}'s ${name}` : name;
}
