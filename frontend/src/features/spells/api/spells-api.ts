import { apiRequest } from "../../../lib/api-client";

import type { Spell } from "../types/spell-types";

type ListSpellsOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
};

export type SpellCreatePayload = {
  campaign_id: number;
  name: string;
  type: string;
  description: string;
  dc?: number | null;
};

export function listSpells(options: ListSpellsOptions = {}) {
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
  const path = query ? `/spells/?${query}` : "/spells/";
  return apiRequest<Spell[]>(path);
}

export function createSpell(payload: SpellCreatePayload) {
  return apiRequest<Spell>("/spells/", {
    method: "POST",
    body: payload,
  });
}

export function getSpell(spellId: number) {
  return apiRequest<Spell>(`/spells/${spellId}/`);
}
