export type HouseRule = {
  id: number;
  campaign_id: number;
  title: string;
  description: string;
  effect_key: string | null;
  created_at: string;
  updated_at: string;
};

/** A common house rule as `rules/common/` lists it; `effect_key` is null for text only. */
export type CommonRule = {
  id: string;
  title: string;
  description: string;
  effect_key: string | null;
};

export type HouseRulePayload = {
  title: string;
  description: string;
  effect_key?: string | null;
};
