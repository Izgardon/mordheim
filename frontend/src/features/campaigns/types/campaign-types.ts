export type CampaignRole = "owner" | "admin" | "player";

export type CampaignSummary = {
  id: number;
  name: string;
  campaign_type: string;
  campaign_type_name?: string;
  join_code: string;
  max_players: number;
  player_count: number;
  role: CampaignRole;
  created_at: string;
  updated_at: string;
};

export type CampaignCreatePayload = {
  name: string;
  campaign_type: string;
  max_players: number;
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
