export type ItemProperty = {
  id: number;
  campaign_id?: number | null;
  name: string;
  description: string;
  type: string;
};

export type ItemAvailability = {
  id: number;
  cost: number;
  rarity: number;
  unique_to: string;
  variable_cost?: string | null;
};

export type Item = {
  id: number;
  campaign_id?: number | null;
  name: string;
  type: string;
  subtype?: string;
  grade?: string;
  /** Cost from the join table (HeroItem.cost, WarbandItem.cost) when loaded via warband APIs. */
  cost?: number | null;
  single_use?: boolean;
  description: string;
  strength?: string | null;
  range?: string | null;
  save?: string | null;
  statblock?: string | null;
  properties?: { id: number; name: string; type: string }[];
  availabilities: ItemAvailability[];
};

export type ItemCreatePayload = {
  name: string;
  type: string;
  subtype?: string;
  grade?: string;
  single_use?: boolean;
  description: string;
  strength?: string | null;
  range?: string | null;
  save?: string | null;
  statblock?: string | null;
  property_ids?: number[];
  availabilities: Omit<ItemAvailability, "id">[];
  campaign_id: number;
};

export type ItemUpdatePayload = {
  name?: string;
  type?: string;
  subtype?: string;
  grade?: string;
  single_use?: boolean;
  description?: string;
  strength?: string | null;
  range?: string | null;
  save?: string | null;
  statblock?: string | null;
  property_ids?: number[];
  availabilities?: Omit<ItemAvailability, "id">[];
};
