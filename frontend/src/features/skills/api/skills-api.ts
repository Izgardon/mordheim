// api
import { apiRequest } from "../../../lib/api-client";

// types
import type { Skill, SkillCreatePayload } from "../types/skill-types";

type ListSkillsOptions = {
  type?: string;
  search?: string;
};

export function listSkills(options: ListSkillsOptions = {}) {
  const params = new URLSearchParams();
  if (options.type) {
    params.set("type", options.type);
  }
  if (options.search) {
    params.set("search", options.search);
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




