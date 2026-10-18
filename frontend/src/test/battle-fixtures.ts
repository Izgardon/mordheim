/**
 * A two-player battle for the battle screens' tests, in the API's shapes: the signed-in user (7,
 * the creator, "Iron Vultures") against user 9 ("Night Razors"), battle 5 in campaign 1.
 */
import type {
  BattleEvent,
  BattleParticipant,
  BattleParticipantStatus,
  BattleRosterMap,
  BattleRosterUnit,
  BattleState,
  BattleStatus,
  BattleSummary,
  BattleUnitInformationEntry,
  BattleUnitStats,
} from "@/features/battles/types/battle-types";

export const CAMPAIGN_ID = 1;
export const BATTLE_ID = 5;
export const ME = { id: 7, label: "Owner", warband: { id: 101, name: "Iron Vultures" } };
export const OPPONENT = { id: 9, label: "Player", warband: { id: 102, name: "Night Razors" } };

export const BATTLE_CHANNEL = `private-battle-${BATTLE_ID}`;

/** `"/campaigns/1/battles/5/<suffix>"`. */
export const battlePath = (suffix: string) =>
  `/campaigns/${CAMPAIGN_ID}/battles/${BATTLE_ID}/${suffix}`;

/** The state read a phase page sends: `state/?sinceEventId=<n>&view=<view>`. */
export const statePath = (view: string, sinceEventId = 0) =>
  battlePath(`state/?sinceEventId=${sinceEventId}&view=${view}`);

const stats = (overrides: Partial<BattleUnitStats> = {}): BattleUnitStats => ({
  movement: 4,
  weapon_skill: 4,
  ballistic_skill: 4,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 4,
  attacks: 1,
  leadership: 7,
  armour_save: null,
  ...overrides,
});

const rosterUnit = (
  unit: Pick<BattleRosterUnit, "key" | "id" | "kind" | "displayName" | "unitType"> &
    Partial<BattleRosterUnit>
): BattleRosterUnit => ({
  stats: stats(),
  items: [],
  singleUseItems: [],
  skills: [],
  spells: [],
  specials: [],
  ...unit,
});

/** Both warbands as `GET rosters/` answers: keyed by user id. */
export const battleRosters = (): BattleRosterMap => ({
  [String(ME.id)]: {
    heroes: [
      rosterUnit({
        key: "hero:1",
        id: 1,
        kind: "hero",
        displayName: "Captain Wolf",
        unitType: "Captain",
        stats: stats({ wounds: 2, leadership: 8 }),
      }),
      rosterUnit({ key: "hero:3", id: 3, kind: "hero", displayName: "Rolf", unitType: "Champion" }),
    ],
    hiredSwords: [
      rosterUnit({
        key: "hired_sword:4",
        id: 4,
        kind: "hired_sword",
        displayName: "Ogre Bodyguard",
        unitType: "Ogre",
        stats: stats({ wounds: 3 }),
        upkeepPrice: 15,
        upkeepCostExpression: "15 gc",
      }),
    ],
    henchmenGroups: [
      {
        id: 11,
        name: "Youngbloods",
        unitType: "Youngblood",
        members: [
          rosterUnit({
            key: "henchman:2",
            id: 2,
            kind: "henchman",
            displayName: "Youngblood A",
            unitType: "Youngblood",
          }),
        ],
      },
    ],
  },
  [String(OPPONENT.id)]: {
    heroes: [
      rosterUnit({
        key: "hero:2",
        id: 2,
        kind: "hero",
        displayName: "Black Fang",
        unitType: "Assassin",
      }),
    ],
    hiredSwords: [],
    henchmenGroups: [],
  },
});

export const MY_UNIT_KEYS = ["hero:1", "hero:3", "henchman:2", "hired_sword:4"];

type ParticipantOptions = Partial<Omit<BattleParticipant, "unit_information_json">> & {
  unit_information_json?: Record<string, Partial<BattleUnitInformationEntry>>;
};

const participant = (
  id: number,
  who: typeof ME,
  selected: string[],
  { unit_information_json = {}, ...overrides }: ParticipantOptions
): BattleParticipant => ({
  id,
  battle_id: BATTLE_ID,
  status: "in_battle",
  connection_state: "online",
  last_event_id: 0,
  last_seen_at: null,
  selected_unit_keys_json: selected,
  unit_information_json: unit_information_json as Record<string, BattleUnitInformationEntry>,
  custom_units_json: [],
  postbattle_json: {},
  declared_rating: null,
  battle_notes: "",
  user: { id: who.id, label: who.label },
  warband: who.warband,
  ...overrides,
});

/** Your participant row (user 7, every unit selected). */
export const myParticipant = (overrides: ParticipantOptions = {}) =>
  participant(21, ME, MY_UNIT_KEYS, overrides);

/** The other player's row (user 9). */
export const opponentParticipant = (overrides: ParticipantOptions = {}) =>
  participant(22, OPPONENT, ["hero:2"], overrides);

/** A participant status that fits the battle's phase. */
const participantStatusFor = (status: BattleStatus): BattleParticipantStatus => {
  if (status === "inviting") return "accepted";
  if (status === "prebattle") return "joined_prebattle";
  if (status === "postbattle") return "finished_battle";
  return "in_battle";
};

type BattleStateOptions = Partial<BattleSummary> & {
  me?: ParticipantOptions;
  opponent?: ParticipantOptions;
  events?: BattleEvent[];
};

/** A `GET state/` answer; both participants get a status that fits `status` unless given. */
export function battleState({
  status = "active",
  me = {},
  opponent = {},
  events = [],
  ...battle
}: BattleStateOptions = {}): BattleState {
  const participantStatus = participantStatusFor(status);
  return {
    battle: {
      id: BATTLE_ID,
      campaign_id: CAMPAIGN_ID,
      created_by_user_id: ME.id,
      flow_type: "normal",
      status,
      scenario: "Street Fight",
      scenario_link: null,
      winner_warband_ids_json: [],
      created_at: "2026-10-18T10:00:00Z",
      updated_at: "2026-10-18T10:00:00Z",
      started_at: null,
      ended_at: null,
      post_processed_at: null,
      channel: BATTLE_CHANNEL,
      ...battle,
    },
    participants: [
      myParticipant({ status: participantStatus, ...me }),
      opponentParticipant({ status: participantStatus, ...opponent }),
    ],
    events,
  };
}

/** A timeline event, as `state/` returns it and `battle.event` carries it. */
export const battleEvent = (
  id: number,
  type: BattleEvent["type"],
  actorUserId: number | null,
  payload: Record<string, unknown> = {}
): BattleEvent => ({
  id,
  battle_id: BATTLE_ID,
  type,
  actor_user_id: actorUserId,
  payload_json: payload,
  created_at: "2026-10-18T10:05:00Z",
});

/** What `battle.event` carries for a timeline event (`send_battle_event`): its type and the event. */
export const socketMessage = (event: BattleEvent) => ({ type: event.type, payload: event });

/** What `battle.event` carries for a config, ready or join change (`battle_state_updated`). */
export const stateUpdatedMessage = (status: BattleStatus, actorUserId: number) => ({
  type: "battle_state_updated",
  payload: {
    battle_id: BATTLE_ID,
    campaign_id: CAMPAIGN_ID,
    status,
    actor_user_id: actorUserId,
  },
});

/** A promise resolved from outside: holds a fake server's answer until the test releases it. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
