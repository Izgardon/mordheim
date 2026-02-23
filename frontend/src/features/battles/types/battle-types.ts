export type BattleStatus =
  | "inviting"
  | "prebattle"
  | "active"
  | "postbattle"
  | "ended"
  | "canceled";

export type BattleParticipantStatus =
  | "invited"
  | "accepted"
  | "joined_prebattle"
  | "ready"
  | "canceled_prebattle"
  | "in_battle"
  | "finished_battle"
  | "confirmed_postbattle";

export type BattleUnitStats = {
  movement: number;
  weapon_skill: number;
  ballistic_skill: number;
  strength: number;
  toughness: number;
  wounds: number;
  initiative: number;
  attacks: number;
  leadership: number;
  armour_save: string;
};

export type BattleCustomUnit = {
  key: string;
  name: string;
  unit_type: string;
  reason: string;
  rating?: number;
  stats: BattleUnitStats;
};

export type BattleEventType =
  | "battle_created"
  | "participant_invited"
  | "participant_accepted"
  | "participant_joined_prebattle"
  | "participant_ready_set"
  | "participant_ready_unset"
  | "participant_canceled_prebattle"
  | "participant_rejoined"
  | "battle_prebattle_opened"
  | "battle_started"
  | "participant_joined_battle"
  | "kill_recorded"
  | "death_recorded"
  | "item_used"
  | "participant_finished_battle"
  | "battle_entered_postbattle"
  | "winner_declared"
  | "participant_confirmed_postbattle"
  | "battle_ended"
  | "battle_canceled";

export type BattleSummary = {
  id: number;
  campaign_id: number;
  created_by_user_id: number;
  title: string;
  status: BattleStatus;
  scenario: string;
  winner_warband_id: number | null;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  ended_at: string | null;
  post_processed_at: string | null;
  channel: string;
};

export type BattleParticipant = {
  id: number;
  battle_id: number;
  status: BattleParticipantStatus;
  connection_state: "online" | "offline";
  last_event_id: number;
  invited_by_user_id: number | null;
  invited_at: string | null;
  responded_at: string | null;
  joined_at: string | null;
  ready_at: string | null;
  canceled_at: string | null;
  battle_joined_at: string | null;
  finished_at: string | null;
  confirmed_at: string | null;
  last_seen_at: string | null;
  selected_unit_keys_json: string[];
  stat_overrides_json: Record<string, unknown>;
  custom_units_json: BattleCustomUnit[];
  declared_rating: number | null;
  user: {
    id: number;
    label: string;
  };
  warband: {
    id: number;
    name: string;
  };
};

export type BattleEvent = {
  id: number;
  battle_id: number;
  type: BattleEventType;
  actor_user_id: number | null;
  payload_json: Record<string, unknown>;
  created_at: string;
};

export type BattleState = {
  battle: BattleSummary;
  participants: BattleParticipant[];
  events: BattleEvent[];
};

export type BattleCreatePayload = {
  title?: string;
  scenario: string;
  participant_user_ids?: number[];
  participant_ratings?: Record<string, number | null>;
  settings_json?: Record<string, unknown>;
};

export type BattleInviteNotification = {
  id: string;
  battleId: number;
  campaignId: number;
  title: string;
  scenario: string;
  createdByUserId: number | null;
  createdByLabel: string;
  createdAt: string;
};
