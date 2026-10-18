import type { Restriction } from "../../items/types/item-types";
import type { BattleParticipant, BattleSummary } from "@/features/battles/types/battle-types";

export type CampaignRole = "owner" | "admin" | "player";
export type CampaignHeroDeathRoll = "d66" | "d100";
export type CampaignCreateType = "standard" | "marienburg";

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
  locations?: boolean;
  enable_encampments?: boolean;
  enable_locations?: boolean;
  item_settings?: Restriction[];
  player_count: number;
  role: CampaignRole;
  /** The caller's permission codes; only the campaign detail endpoint includes them. */
  permissions?: string[];
  in_progress: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignCreatePayload = {
  name: string;
  campaign_type?: CampaignCreateType;
  max_players?: number;
  max_heroes?: number;
  max_hired_swords?: number;
  max_games?: number;
  starting_gold?: number;
  hero_death_roll?: CampaignHeroDeathRoll;
  enable_encampments?: boolean;
  enable_locations?: boolean;
  item_setting_ids?: number[];
};

export type CampaignUpdatePayload = {
  in_progress?: boolean;
  max_heroes?: number;
  max_hired_swords?: number;
  starting_gold?: number;
  hero_death_roll?: CampaignHeroDeathRoll;
  enable_encampments?: boolean;
  enable_locations?: boolean;
  hero_level_thresholds?: number[];
  henchmen_level_thresholds?: number[];
  hired_sword_level_thresholds?: number[];
  item_setting_ids?: number[];
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
  warband?: {
    id: number;
    name: string;
    faction: string;
    wins: number | null;
    losses: number | null;
    rating?: number | null;
  } | null;
};

export type CampaignWarband = {
  id: number;
  name: string;
  faction: string;
  restrictions?: { id: number; type: string; restriction: string }[];
};

export type CampaignBattleHistoryParticipant = {
  warband_id: number;
  warband_name: string;
  kills: number | null;
  ooas: number | null;
  deaths: string[];
  xp_gain: number | null;
  exploration: number[];
};

export type CampaignBattleHistoryEntry = {
  id: number;
  scenario: string;
  winners: string[];
  date: string;
  participants: CampaignBattleHistoryParticipant[];
};

export type CampaignActiveBattle = {
  battle: BattleSummary;
  participants: BattleParticipant[];
};

export type CampaignPivotalMoment = {
  id: number;
  kind: string;
  headline: string;
  detail: string;
  unit_key: string | null;
  unit_name: string | null;
  warband_id: number;
  warband_name: string;
  battle_id: number;
  battle_scenario: string;
  source_event_id: number | null;
  battle_ended_at: string;
  date: string;
};

export type CampaignTopKiller = {
  unit_id: number;
  unit_kind: "hero" | "hired_sword" | "henchman";
  unit_name: string;
  unit_type?: string | null;
  warband_id: number;
  warband_name: string;
  kills: number;
};

export type CampaignBulletinEntry = {
  id: number;
  campaign_id: number;
  user_id: number | null;
  username: string;
  body: string;
  created_at: string;
};

export type CampaignEncampment = {
  id: number;
  campaign_id: number;
  name: string;
  owner_id: number | null;
  owner_name: string | null;
  description: string;
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

export type CampaignPermission = {
  code: string;
  name: string;
};

export type CampaignMessage = {
  id: number;
  campaign_id: number;
  user_id: number | null;
  username: string;
  body: string;
  created_at: string;
};
