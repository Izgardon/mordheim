import type { BattleParticipant, BattleSummary } from "@/features/battles/types/battle-types";
import type { CampaignCapability } from "../capabilities";

export type CampaignRole = "owner" | "admin" | "player";
export type CampaignHeroDeathRoll = "d66" | "d100";

export type CampaignSummary = {
  id: number;
  name: string;
  join_code: string;
  max_players: number;
  max_heroes: number;
  max_hired_swords: number;
  max_games: number;
  starting_gold: number;
  hero_death_roll?: CampaignHeroDeathRoll;
  hero_level_thresholds?: number[];
  henchmen_level_thresholds?: number[];
  hired_sword_level_thresholds?: number[];
  enable_encampments?: boolean;
  enable_locations?: boolean;
  /** The settings in play (grading phase 1): the ones ticked, the always-on Mordheim among them. */
  setting_ids?: number[];
  player_count: number;
  role: CampaignRole;
  /** The caller's permission codes; only the campaign detail endpoint includes them. */
  permissions?: string[];
  /**
   * What the caller may do (design 0.29); only the detail includes them. Read them through
   * `capabilities.ts`, which treats a missing flag as false.
   */
  capabilities?: Partial<Record<CampaignCapability, boolean>>;
  in_progress: boolean;
  /** Set while the campaign is archived: read-only for everyone until its owner restores it. */
  archived_at?: string | null;
  /** Chat messages from others after your read mark (the detail only, CAMP-TWEAK-09). */
  chat_unread?: number;
  /** Your own warband in it, or null without one (the campaigns list only). */
  my_warband?: { id: number; name: string; type_name: string } | null;
  created_at: string;
  updated_at: string;
};

export type CampaignCreatePayload = {
  name: string;
  /** The settings in play; without them, the preset's (Up to 1c when neither is sent). */
  setting_ids?: number[];
  preset?: string;
  max_players?: number;
  max_heroes?: number;
  max_hired_swords?: number;
  max_games?: number;
  starting_gold?: number;
  hero_death_roll?: CampaignHeroDeathRoll;
  enable_encampments?: boolean;
  enable_locations?: boolean;
};

export type CampaignUpdatePayload = {
  in_progress?: boolean;
  /** A rename (the owner): trimmed, never blank. */
  name?: string;
  max_heroes?: number;
  max_hired_swords?: number;
  starting_gold?: number;
  /** With a new starting gold: whether existing warbands get the difference (decision 6). */
  adjust_existing_warbands?: boolean;
  hero_death_roll?: CampaignHeroDeathRoll;
  enable_encampments?: boolean;
  enable_locations?: boolean;
  hero_level_thresholds?: number[];
  henchmen_level_thresholds?: number[];
  hired_sword_level_thresholds?: number[];
  /** Replaces the settings in play (Mordheim stays). */
  setting_ids?: number[];
};

export type CampaignJoinPayload = {
  join_code: string;
};

export type CampaignPlayer = {
  id: number;
  name: string;
  battle_busy?: boolean;
  battle_busy_status?: "inviting" | "prebattle" | "active" | "postbattle" | null;
  /** The open battle a busy player is in, and its last write (decision 1). */
  battle_busy_battle_id?: number | null;
  battle_busy_last_activity_at?: string | null;
  /** His own status in that battle(finished_battle is his post-game). */
  battle_busy_participant_status?: string | null;
  warband?: {
    id: number;
    name: string;
    /** Its warband type's name. */
    type_name: string;
    wins: number | null;
    losses: number | null;
    rating?: number | null;
  } | null;
};

/** `GET players/?fields=basic`: just who is in the campaign, for name pickers (PERF-41). */
export type CampaignPlayerName = Pick<CampaignPlayer, "id" | "name">;

export type CampaignBattleHistoryParticipant = {
  warband_id: number;
  warband_name: string;
  kills: number | null;
  ooas: number | null;
  deaths: string[];
  xp_gain: number | null;
  exploration: number[];
  /** The exploration's shards and the heroes the post-game left dead. */
  shards?: number | null;
  heroes_lost?: number;
};

/**
 * A battle's pivotal moment (next step 9), in fight order: the fight's by round, then the
 * results. A kill moment carries its kill's round; `unit` is the warband page's card it is about.
 */
export type CampaignBattleMoment = {
  id: number;
  /** "first_blood", "hero_slayer", "wiped_out"… */
  kind: string;
  /** "First Blood". */
  headline: string;
  /** "Kurt drew first blood against Magister Halvard." */
  detail: string;
  round: number | null;
  /** "Round 2", "During" (a kill logged after the fight) or "Result". */
  tag: string;
  warband_id: number;
  warband_name: string;
  unit: { kind: "hero" | "henchmen_group" | "hireling"; id: number; name: string } | null;
};

export type CampaignBattleHistoryEntry = {
  id: number;
  scenario: string;
  winners: string[];
  date: string;
  participants: CampaignBattleHistoryParticipant[];
  moments?: CampaignBattleMoment[];
};

export type CampaignChronicleKind =
  | "kill"
  | "death"
  | "level"
  | "buy"
  | "trade"
  | "bounty_posted"
  | "bounty_claimed";

/** A chronicle filter: one kind, or a bounty's two ("bounty": posted and claimed). */
export type CampaignChronicleFilter = "kill" | "death" | "level" | "buy" | "trade" | "bounty";

/** One chronicle entry (GET chronicle/): what happened, where, and when. */
export type CampaignChronicleEntry = {
  kind: CampaignChronicleKind;
  text: string;
  meta: string;
  at: string;
};

export type CampaignActiveBattle = {
  battle: BattleSummary;
  participants: BattleParticipant[];
  /** The owner tools that apply to this battle now (BATL-NEW-03). */
  actions?: { end: boolean; confirm_results: boolean; close_postbattle: boolean; cancel: boolean };
  /** Seconds since the battle's last write, and whether that is past the server's 24 h. */
  idle_seconds?: number | null;
  stuck?: boolean;
};

/** Who removed a post: an owner or admin, or its author (decision 8). */
export type PostRemovedBy = "admin" | "author";

export type CampaignEncampment = {
  id: number;
  campaign_id: number;
  name: string;
  owner_id: number | null;
  owner_name: string | null;
  /** The owner has left the campaign (shown as "(left)"). */
  owner_left?: boolean;
  description: string;
  /** Whether you may edit, reassign and remove it: its owner, or manage_encampments. */
  capabilities?: { edit?: boolean };
};

export type CampaignEncampmentPayload = {
  name: string;
  owner_id?: number | null;
  description?: string;
};

export type CampaignLocation = {
  id: number;
  campaign_id: number;
  name: string;
  /** Free text ("The Docks"); "" when none. The panel filters by the areas in use. */
  area: string;
  content: string;
  d6_1: string;
  d6_2: string;
  d6_3: string;
  d6_4: string;
  d6_5: string;
  d6_6: string;
};

export type CampaignLocationPayload = {
  name: string;
  area?: string;
  content?: string;
  d6_1?: string;
  d6_2?: string;
  d6_3?: string;
  d6_4?: string;
  d6_5?: string;
  d6_6?: string;
};

export type CampaignMember = {
  id: number;
  name: string;
  email: string;
  role: CampaignRole;
  permissions: string[];
  warband_id?: number | null;
  warband_name?: string | null;
};

/**
 * What removing a member closes (`GET members/:user/removal/`). The warband is always kept and
 * comes back if they rejoin; `outcome` is `cancelled` (for everyone) or `skipped` (only them, the
 * battle goes on). Trades that have already run out aren't listed.
 */
export type MemberRemovalPreview = {
  member: { id: number; name: string; role: CampaignRole };
  warband: { id: number; name: string } | null;
  battles: { id: number; scenario: string; status: string; outcome: "cancelled" | "skipped" }[];
  trades: { id: string; status: string; with: { id: number; name: string } }[];
  notifications: number;
};

/** What leaving closes (`GET leave/`): removal's preview, and whether it archives the campaign. */
export type LeavePreview = MemberRemovalPreview & { archives_campaign: boolean };

/** A permission code as `GET permissions/` (and the grant PUT) answer it, in the server's order. */
export type CampaignPermission = {
  code: string;
  label: string;
  description: string;
};

export type CampaignMessage = {
  id: number;
  campaign_id: number;
  user_id: number | null;
  username: string;
  /** Empty once removed. */
  body: string;
  created_at: string;
  removed_at?: string | null;
  removed_by?: PostRemovedBy | null;
};

/** One unit's stat line in the overview's expanded roster row (from `roster-stats/`). */
export type RosterUnit = {
  id: string;
  category: "Heroes" | "Henchmen" | "Hired Swords";
  name: string | null;
  unit_type: string | null;
  movement: number | null;
  weapon_skill: number | null;
  ballistic_skill: number | null;
  strength: number | null;
  toughness: number | null;
  wounds: number | null;
  initiative: number | null;
  attacks: number | null;
  leadership: number | null;
  armour_save: number | null;
};

/** A setting (grading phase 1): the world or supplement content belongs to, holding its grade. */
export type Setting = {
  id: number;
  slug: string;
  name: string;
  /** 1a, 1b, 1c, 2a, 2b or 3. */
  grade: string;
  /** The grade's name: Official, Unofficial, Experimental, Reliable, Supplemental, Draft. */
  grade_label: string;
  sort_order: number;
  /** In play in every campaign: Mordheim. */
  always_on: boolean;
  /** How many of the book's warband types it holds. */
  warband_types: number;
};

/** "Up to 1c": every setting at or below the grade, which the owner then adjusts. */
export type SettingPreset = {
  grade: string;
  label: string;
  description: string;
  setting_ids: number[];
};

export type SettingsList = { settings: Setting[]; presets: SettingPreset[] };
