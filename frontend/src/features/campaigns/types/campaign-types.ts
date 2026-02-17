export type CampaignRole = "owner" | "admin" | "player";

export type CampaignSummary = {
  id: number;
  name: string;
  campaign_type: string;
  campaign_type_name?: string;
  join_code: string;
  max_players: number;
  max_heroes: number;
  max_hired_swords: number;
  max_games: number;
  starting_gold: number;
  hero_level_thresholds?: number[];
  henchmen_level_thresholds?: number[];
  hired_sword_level_thresholds?: number[];
  player_count: number;
  role: CampaignRole;
  in_progress: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignCreatePayload = {
  name: string;
  campaign_type: string;
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
  warband?: {
    id: number;
    name: string;
    faction: string;
    wins: number | null;
    losses: number | null;
  } | null;
};

export type CampaignMember = {
  id: number;
  name: string;
  email: string;
  role: CampaignRole;
  permissions: string[];
};

export type CampaignPermission = {
  code: string;
  name: string;
};

export type CampaignType = {
  code: string;
  name: string;
};
