// api
import { apiRequest } from "../../../lib/api-client";

// types
import type { Skill, SkillCreatePayload, SkillUpdatePayload } from "../types/skill-types";

type ListSkillsOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
};

export function listSkills(options: ListSkillsOptions = {}) {
  const params = new URLSearchParams();
  if (options.type) {
    params.set("type", options.type);
  }
  if (options.search) {
    params.set("search", options.search);
  }
  if (options.campaignId) {
    params.set("campaign_id", String(options.campaignId));
  }
  const query = params.toString();
  const path = query ? `/skills/?${query}` : "/skills/";
  return apiRequest<Skill[]>(path);
}

export function createSkill(payload: SkillCreatePayload) {
  return apiRequest<Skill>("/skills/", {
    method: "POST",
    body: payload,
  });
}

export function updateSkill(skillId: number, payload: SkillUpdatePayload) {
  return apiRequest<Skill>(`/skills/${skillId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteSkill(skillId: number) {
  return apiRequest<void>(`/skills/${skillId}/`, {
    method: "DELETE",
  });
}




