export type CampaignRole = "owner" | "admin" | "player";

export type CampaignSummary = {
  id: number;
  name: string;
  join_code: string;
  max_players: number;
  max_heroes: number;
  max_hired_swords: number;
  max_games: number;
  starting_gold: number;
  hero_level_thresholds?: number[];
  henchmen_level_thresholds?: number[];
  hired_sword_level_thresholds?: number[];
  locations?: boolean;
  player_count: number;
  role: CampaignRole;
  in_progress: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignCreatePayload = {
  name: string;
  max_players?: number;
  max_heroes?: number;
  max_hired_swords?: number;
  max_games?: number;
  starting_gold?: number;
};

export type CampaignUpdatePayload = {
  in_progress?: boolean;
  max_heroes?: number;
  max_hired_swords?: number;
  starting_gold?: number;
  hero_level_thresholds?: number[];
  henchmen_level_thresholds?: number[];
  hired_sword_level_thresholds?: number[];
};

export type CampaignJoinPayload = {
  join_code: string;
};

export type CampaignPlayer = {
  id: number;
  name: string;
  battle_busy?: boolean;
  battle_busy_status?: "inviting" | "prebattle" | "active" | "postbattle" | null;
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
