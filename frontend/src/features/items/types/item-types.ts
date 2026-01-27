export type ItemProperty = {
  id: number;
  campaign_id?: number | null;
  name: string;
  description: string;
  type: string;
};

export type Item = {
  id: number;
  campaign_id?: number | null;
  name: string;
  type: string;
  subtype?: string;
  grade?: string;
  cost: number;
  rarity: number;
  unique_to: string;
  variable?: string | null;
  single_use?: boolean;
  description: string;
  strength?: string | null;
  range?: string | null;
  save?: string | null;
  statblock?: string | null;
  properties?: { id: number; name: string; type: string }[];
};

export type ItemCreatePayload = {
  name: string;
  type: string;
  subtype?: string;
  grade?: string;
  cost: number;
  rarity: number;
  unique_to: string;
  variable?: string | null;
  single_use?: boolean;
  description: string;
  strength?: string | null;
  range?: string | null;
  save?: string | null;
  statblock?: string | null;
  property_ids?: number[];
  campaign_id: number;
};

export type ItemUpdatePayload = {
  name?: string;
  type?: string;
  subtype?: string;
  grade?: string;
  cost?: number;
  rarity?: number;
  unique_to?: string;
  variable?: string | null;
  single_use?: boolean;
  description?: string;
  strength?: string | null;
  range?: string | null;
  save?: string | null;
  statblock?: string | null;
};
