export type HouseRule = {
  id: number;
  campaign_id: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type HouseRulePayload = {
  title: string;
  description: string;
};
