// api
import { apiRequest } from "../../../lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

// types
import type {
  Skill,
  SkillCreatePayload,
  SkillGroup,
  SkillGroupPayload,
  SkillUpdatePayload,
} from "../types/skill-types";

type ListOptions = {
  search?: string;
  campaignId?: number;
  /** Archived entries and book entries removed for the campaign too (`?archived=1`). */
  archived?: boolean;
  signal?: AbortSignal;
};

function listPath(base: string, options: ListOptions) {
  const params = new URLSearchParams();
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
  return query ? `${base}?${query}` : base;
}

export function listSkills(options: ListOptions = {}) {
  return apiRequest<Skill[]>(listPath("/skills/", options), { signal: options.signal });
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

/** The campaign's skill groups: the core five first, then by name. */
export function listSkillGroups(options: ListOptions = {}) {
  return apiRequest<SkillGroup[]>(listPath("/skill-groups/", options), { signal: options.signal });
}

export function createSkillGroup(payload: SkillGroupPayload & { campaign_id: number }) {
  return apiRequest<SkillGroup>("/skill-groups/", {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function updateSkillGroup(groupId: number, payload: SkillGroupPayload) {
  return apiRequest<SkillGroup>(`/skill-groups/${groupId}/`, {
    method: "PATCH",
    headers: socketIdHeaders(),
    body: payload,
  });
}
