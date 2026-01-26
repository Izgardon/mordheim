export type Item = {
  id: number;
  campaign_id?: number | null;
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

export type ItemUpdatePayload = {
  name?: string;
  type?: string;
  cost?: number;
  rarity?: number;
  unique_to?: string;
  variable?: string | null;
  description?: string;
};
