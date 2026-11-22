import { apiRequest } from "../../../lib/api-client";
import type { SpecialCategory, SpecialKind } from "@/components/ui/game-icons";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type { Special } from "../types/special-types";

type ListSpecialOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
  signal?: AbortSignal;
};

export type SpecialCreatePayload = {
  campaign_id: number;
  name: string;
  /** Left out: none (the book's keep theirs; a campaign's own has no type). */
  type?: string;
  /** Left out: a trait. */
  kind?: SpecialKind;
  /** Left out: an aura. */
  category?: SpecialCategory;
  description: string;
  /** Its price in gold crowns where a list sells it; null: none. */
  cost?: number | null;
  prebattle_roll?: string;
  prebattle_text?: string;
};

export function listSpecial(options: ListSpecialOptions = {}) {
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
  const path = query ? `/special/?${query}` : "/special/";
  return apiRequest<Special[]>(path, { signal: options.signal });
}

/** A special's edit; a book special's first edit makes the campaign's version (`campaign_id`). */
export function updateSpecial(
  specialId: number,
  payload: Omit<SpecialCreatePayload, "campaign_id"> & { campaign_id?: number }
) {
  return apiRequest<Special>(`/special/${specialId}/`, {
    method: "PATCH",
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function createSpecial(payload: SpecialCreatePayload) {
  return apiRequest<Special>("/special/", {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}
