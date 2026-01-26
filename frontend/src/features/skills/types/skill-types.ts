export type Skill = {
  id: number;
  campaign_id?: number | null;
  name: string;
  type: string;
  description: string;
};

export type SkillCreatePayload = {
  name: string;
  type: string;
  description: string;
  campaign_id: number;
};

export type SkillUpdatePayload = {
  name?: string;
  type?: string;
  description?: string;
};
