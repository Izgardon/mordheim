import type { BattleWarning } from "@/features/battles/utils/battle-warnings";
import type { CampaignHeroDeathRoll } from "@/features/campaigns/types/campaign-types";

export type BattleFlowType = "normal" | "reported_result";
export type BattleStateView = "full" | "prebattle" | "active" | "postbattle";

export type BattleStatus =
  | "inviting"
  | "reported_result_pending"
  | "prebattle"
  | "active"
  | "postbattle"
  | "ended"
  | "canceled";

export type BattleParticipantStatus =
  | "invited"
  | "accepted"
  | "reported_result_pending"
  | "reported_result_approved"
  | "reported_result_declined"
  | "joined_prebattle"
  | "ready"
  | "canceled_prebattle"
  | "declined"
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
  armour_save: number | null;
};

export type BattleCustomUnit = {
  key: string;
  name: string;
  unit_type: string;
  rating?: number;
  stats: BattleUnitStats;
};

export type BattleUnitInformationEntry = {
  stats_override: Partial<BattleUnitStats>;
  notes?: string;
  current_wounds?: number | null;
  out_of_action: boolean;
  kill_count: number;
};

export type BattlePostbattleSeriousInjuryRoll = {
  roll_type: "d6" | "d66" | "d100";
  rolls: number[];
  result_code: string;
  result_label: string;
  dead_suggestion: boolean;
  /** Ticked to apply at finalise (default true); only the unit's last roll counts (BUG-47). */
  apply?: boolean;
  /** What the server's table says the result does. */
  effect?: {
    kind: "dead" | "stat" | "special" | "none" | "manual";
    stat?: string;
    change?: number;
    special?: string;
  };
};

export type BattlePostbattleUnitResult = {
  unit_name: string;
  unit_kind: "hero" | "hired_sword" | "henchman";
  unit_type: string;
  group_name: string;
  out_of_action: boolean;
  kill_count: number;
  xp_earned: number;
  dead: boolean;
  special_ids: number[];
  serious_injury_rolls: BattlePostbattleSeriousInjuryRoll[];
  /** Battle stat changes become permanent only when ticked (SEC-10, decision 6). */
  keep_stats?: boolean;
};

export type BattlePostbattleExploration = {
  dice_values: number[];
  resource_id: number | null;
  amount_override?: number | null;
  /** Server-computed (the chart, or the override) and server-kept; ignored on input. */
  amount?: number;
  previous_rolls?: number[][];
};

export type BattlePostbattleUpkeepEntry = {
  unit_name: string;
  cost: number | null;
};

export type BattlePostbattleUpkeep = {
  pay_upkeep: boolean;
  entries: Record<string, BattlePostbattleUpkeepEntry>;
};

export type BattlePostbattleFindItem = {
  item_id: number;
  name: string;
  type: string | null;
  cost: number | null;
};

export type BattlePostbattleFinds = {
  gold_crowns: number;
  items: BattlePostbattleFindItem[];
};

export type BattlePostbattleState = {
  exploration: BattlePostbattleExploration;
  finds: BattlePostbattleFinds;
  upkeep: BattlePostbattleUpkeep;
  unit_results: Record<string, BattlePostbattleUnitResult>;
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
  | "item_used"
  | "unit_ooa_set"
  | "unit_ooa_unset"
  | "unit_kill_recorded"
  | "participant_finished_battle"
  | "battle_entered_postbattle"
  | "winner_declared"
  | "participant_confirmed_postbattle"
  | "battle_ended"
  | "battle_canceled"
  | "participant_declined"
  | "unit_kill_voided"
  | "item_used_voided";

export type BattleSummary = {
  id: number;
  campaign_id: number;
  created_by_user_id: number;
  flow_type: BattleFlowType;
  status: BattleStatus;
  scenario: string;
  scenario_link: string | null;
  winner_warband_ids_json: number[];
  created_at: string;
  updated_at: string;
  started_at: string | null;
  ended_at: string | null;
  post_processed_at: string | null;
  channel: string;
  /** Raised by every write others see (PERF-34; adopted in PR B). */
  state_version?: number;
  /** The last battle write (decision 2: "idle N days"). */
  last_activity_at?: string;
  /** When unanswered invites or an unfinished postbattle close; null otherwise. */
  closes_at?: string | null;
  /** Past `closes_at`, waiting to be settled by the next list read or write. */
  overdue?: boolean;
};

/** The fields every participant view has; `?view=active` sends only these (IMP-54). */
export type BattleParticipantCore = {
  id: number;
  battle_id: number;
  status: BattleParticipantStatus;
  connection_state: "online" | "offline";
  last_event_id: number;
  last_seen_at: string | null;
  selected_unit_keys_json: string[];
  unit_information_json: Record<string, BattleUnitInformationEntry>;
  custom_units_json: BattleCustomUnit[];
  battle_notes: string;
  user: {
    id: number;
    label: string;
  };
  warband: {
    id: number;
    name: string;
  };
};

/** When the participant was invited, answered, joined, readied and finished; not in `active`. */
export type BattleParticipantTimeline = {
  invited_by_user_id: number | null;
  invited_at: string | null;
  responded_at: string | null;
  joined_at: string | null;
  ready_at: string | null;
  canceled_at: string | null;
  battle_joined_at: string | null;
  finished_at: string | null;
  confirmed_at: string | null;
  /** Postbattle closed or expired before this player finished it (BUG-09). */
  skipped_postbattle: boolean;
};

export type BattlePostbattleDraftJson = BattlePostbattleState | Record<string, never>;

/** `?view=active`: the core only. */
export type ActiveViewParticipant = BattleParticipantCore;

/** `?view=prebattle`: the timeline and the declared rating. */
export type PrebattleViewParticipant = BattleParticipantCore &
  BattleParticipantTimeline & { declared_rating: number | null };

/** `?view=postbattle`: the timeline and the postbattle draft. */
export type PostbattleViewParticipant = BattleParticipantCore &
  BattleParticipantTimeline & { postbattle_json: BattlePostbattleDraftJson };

/** `?view=full`: what every write answers with and every socket snapshot carries. */
export type FullViewParticipant = PrebattleViewParticipant & PostbattleViewParticipant;

/** The participant shape each `state/` view returns. */
export type BattleParticipantForView = {
  full: FullViewParticipant;
  prebattle: PrebattleViewParticipant;
  active: ActiveViewParticipant;
  postbattle: PostbattleViewParticipant;
};

/**
 * A participant as the battle pages cache it: reads ask for the shown page's view while writes
 * and socket snapshots carry the full one, so anything beyond the core may be missing.
 */
export type BattleParticipant = BattleParticipantCore &
  Partial<BattleParticipantTimeline> & {
    declared_rating?: number | null;
    postbattle_json?: BattlePostbattleDraftJson;
  };

/** What a kill event says (`unit-kill/`): who took whom out, and whether it earns XP. */
export type UnitKillPayload = {
  killer?: { unit_key?: string; warband_id?: number; name?: string };
  /** A unit of another warband (its key and warband), or only the name typed for one. */
  victim?: { unit_key?: string | null; warband_id?: number | null; name?: string | null };
  earned_xp?: boolean;
  source?: "battle" | "postbattle";
  [field: string]: unknown;
};

/** What an item use says: the unit and the single-use item (BUG-72's whitelisted fields). */
export type ItemUsedPayload = {
  participant_user_id?: number;
  unit_key?: string;
  unit_id?: number | null;
  unit_type?: string;
  item_id?: number;
  item_name?: string;
  [field: string]: unknown;
};

/** What an undo says: the event it voided (BUG-11). */
export type VoidPayload = {
  voided_event_id?: number;
  unit_key?: string;
  [field: string]: unknown;
};

type BattleEventBase = {
  id: number;
  battle_id: number;
  actor_user_id: number | null;
  created_at: string;
  /** Set when a kill or item use was undone; the event stays in the timeline (BUG-11). */
  voided_at?: string | null;
};

type TypedEventType = "unit_kill_recorded" | "item_used" | "unit_kill_voided" | "item_used_voided";

/** A timeline event, typed by `type` for the events the pages read (IMP-54). */
export type BattleEvent =
  | (BattleEventBase & { type: "unit_kill_recorded"; payload_json: UnitKillPayload })
  | (BattleEventBase & { type: "item_used"; payload_json: ItemUsedPayload })
  | (BattleEventBase & { type: "unit_kill_voided" | "item_used_voided"; payload_json: VoidPayload })
  | (BattleEventBase & {
      type: Exclude<BattleEventType, TypedEventType>;
      payload_json: Record<string, unknown>;
    });

/** A battle with its participants in one view's shape. */
export type BattleInjuryEffect = NonNullable<BattlePostbattleSeriousInjuryRoll["effect"]>;

/** One row of a serious-injury table: the rolls from `low` to `high` (D66 codes for d66). */
export type BattleInjuryTableRow = {
  low: number;
  high: number;
  label: string;
  effect: BattleInjuryEffect;
};

/** The postbattle rules the server applies (IMP-52), in `state/?view=postbattle`. */
export type BattlePostbattleRules = {
  /** Ascending; the first row whose `max_total` (null: no limit) covers the dice total. */
  exploration_table: { max_total: number | null; amount: number }[];
  exploration_dice: { max: number; max_chosen: number };
  /** Heroes' serious-injury table; henchmen and hired swords roll d6. */
  hero_death_roll: CampaignHeroDeathRoll;
  injury_tables: Record<"d6" | "d66" | "d100", BattleInjuryTableRow[]>;
};

/** The server's suggestions for the reader's own postbattle (IMP-52). */
export type BattlePostbattleSuggestion = {
  unit_results: Record<string, { xp_earned: number }>;
  exploration: { dice_count: number };
  upkeep: { entries: Record<string, { unit_name: string; cost: number | null }> };
};

/**
 * What the reader may do with the battle now, by the server's own rules (`GET state/` only):
 * start (prebattle, everyone ready), end (active), cancel (before postbattle), close postbattle,
 * edit the record of an ended battle.
 */
export type BattleCapabilities = {
  start: boolean;
  end: boolean;
  cancel: boolean;
  close_postbattle: boolean;
  edit_record: boolean;
};

export type BattleStateOf<Participant extends BattleParticipantCore> = {
  battle: BattleSummary;
  participants: Participant[];
  events: BattleEvent[];
  /** Only in the acting player's answer, only when there are any. */
  warnings?: BattleWarning[];
  /** Only in `state/?view=postbattle`, for the reader's own participant. */
  suggested_postbattle?: BattlePostbattleSuggestion;
  rules?: BattlePostbattleRules;
  /** Only in `state/` reads: what the reader may do (the battle as it was read). */
  capabilities?: BattleCapabilities;
};

/** The battle as the pages cache it. */
export type BattleState = BattleStateOf<BattleParticipant> & {
  /**
   * Client-side: the battle's and participants' statuses when `capabilities` were read
   * (`capabilityBasis`); once they differ, the capabilities are stale until the next read.
   */
  capabilitiesBasis?: string;
};

export type BattleRosterItem = {
  id: number;
  name: string;
  count: number;
  singleUse: boolean;
};

export type BattleRosterSingleUseItem = {
  id: number;
  name: string;
  quantity: number;
};

export type BattleRosterDetailEntry = {
  id: number;
  name: string;
};

export type BattleRosterSpellEntry = BattleRosterDetailEntry & {
  dc?: string | number | null;
};

export type BattleRosterUnit = {
  key: string;
  id: number;
  kind: "hero" | "hired_sword" | "henchman";
  displayName: string;
  unitType: string;
  stats: BattleUnitStats;
  items: BattleRosterItem[];
  singleUseItems: BattleRosterSingleUseItem[];
  skills: BattleRosterDetailEntry[];
  spells: BattleRosterSpellEntry[];
  specials: BattleRosterDetailEntry[];
  upkeepPrice?: number | null;
  upkeepCostExpression?: string | null;
  noLevelUps?: boolean;
};

export type BattleRosterGroup = {
  id: number;
  name: string;
  unitType: string;
  members: BattleRosterUnit[];
};

export type BattleParticipantRoster = {
  heroes: BattleRosterUnit[];
  hiredSwords: BattleRosterUnit[];
  henchmenGroups: BattleRosterGroup[];
};

export type BattleRosterMap = Record<string, BattleParticipantRoster>;

export type BattleCreatePayload = {
  scenario: string;
  scenario_link?: string | null;
  participant_user_ids?: number[];
  participant_ratings?: Record<string, number | null>;
};

export type ReportBattleResultPayload = {
  scenario: string;
  battle_date: string;
  participant_user_ids: number[];
  winner_warband_ids: number[];
};

/** A reported result still waiting for answers, as `pending-results/` lists it (BUG-46). */
export type PendingReportedResult = {
  battle_id: number;
  campaign_id: number;
  status: BattleStatus;
  scenario: string;
  battle_date: string | null;
  winner_warband_ids: number[];
  winner_warband_names: string[];
  created_by_user_id: number;
  created_by_user_label: string;
  created_at: string;
  participants: {
    user_id: number;
    user_label: string;
    warband_id: number;
    warband_name: string;
    status: BattleParticipantStatus;
  }[];
  awaiting_my_answer: boolean;
  can_withdraw: boolean;
};

export type BattleInviteNotification = {
  id: string;
  notificationDbId: number;
  battleId: number;
  campaignId: number;
  title: string;
  scenario: string;
  battleDate: string;
  createdByUserId: number | null;
  createdByLabel: string;
  createdAt: string;
};

export type BattleResultRequestNotification = {
  id: string;
  notificationDbId: number;
  battleId: number;
  campaignId: number;
  title: string;
  scenario: string;
  battleDate: string;
  winnerWarbandIds: number[];
  winnerWarbandNames: string[];
  createdByUserId: number | null;
  createdByLabel: string;
  createdAt: string;
};
