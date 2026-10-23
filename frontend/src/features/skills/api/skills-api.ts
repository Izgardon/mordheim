// api
import { apiRequest } from "../../../lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

// types
import type { Skill, SkillCreatePayload, SkillUpdatePayload } from "../types/skill-types";

type ListSkillsOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
  /** Archived entries and book entries removed for the campaign too (`?archived=1`). */
  archived?: boolean;
  signal?: AbortSignal;
};

export function getSkill(skillId: number) {
  return apiRequest<Skill>(`/skills/${skillId}/`);
}

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
  if (options.archived) {
    params.set("archived", "1");
  }
  const query = params.toString();
  const path = query ? `/skills/?${query}` : "/skills/";
  return apiRequest<Skill[]>(path, { signal: options.signal });
}

export function createSkill(payload: SkillCreatePayload) {
  return apiRequest<Skill>("/skills/", {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function updateSkill(skillId: number, payload: SkillUpdatePayload) {
  return apiRequest<Skill>(`/skills/${skillId}/`, {
    method: "PATCH",
    headers: socketIdHeaders(),
    body: payload,
  });
}
