export type Spell = {
  id: number;
  name: string;
  type?: string | null;
  description?: string | null;
  dc?: string | null;
  roll?: number | null;
  campaign_id?: number | null;
};
