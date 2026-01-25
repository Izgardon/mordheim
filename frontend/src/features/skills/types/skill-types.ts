export type Skill = {
  id: number;
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
