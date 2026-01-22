export type Item = {
  id: number;
  name: string;
  type: string;
  cost: string;
  availability: string;
  unique_to: string;
  custom: boolean;
};

export type ItemCreatePayload = {
  name: string;
  type: string;
  cost: string;
  availability: string;
  unique_to: string;
  custom: boolean;
  campaign_id: number;
};
