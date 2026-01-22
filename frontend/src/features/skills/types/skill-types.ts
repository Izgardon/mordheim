export type Skill = {
  id: number;
  name: string;
  type: string;
  description: string;
  custom: boolean;
};

export type SkillCreatePayload = {
  name: string;
  type: string;
  description: string;
  custom: boolean;
  campaign_id: number;
};
