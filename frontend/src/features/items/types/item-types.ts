export type Item = {
  id: number;
  name: string;
  type: string;
  cost: number;
  rarity: number;
  unique_to: string;
  variable?: string | null;
  description: string;
};

export type ItemCreatePayload = {
  name: string;
  type: string;
  cost: number;
  rarity: number;
  unique_to: string;
  description: string;
  campaign_id: number;
};
