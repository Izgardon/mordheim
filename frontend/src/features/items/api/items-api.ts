import { apiRequest } from "../../../lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type { Item, ItemCreatePayload, ItemRule, ItemUpdatePayload } from "../types/item-types";

type ListItemsOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
  /** Archived entries and book entries removed for the campaign too (`?archived=1`). */
  archived?: boolean;
  signal?: AbortSignal;
};

export function getItem(itemId: number) {
  return apiRequest<Item>(`/items/${itemId}/`);
}

export function listItems(options: ListItemsOptions = {}) {
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
  const path = query ? `/items/?${query}` : "/items/";
  return apiRequest<Item[]>(path, { signal: options.signal });
}

export function createItem(payload: ItemCreatePayload) {
  return apiRequest<Item>("/items/", {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function updateItem(itemId: number, payload: ItemUpdatePayload) {
  return apiRequest<Item>(`/items/${itemId}/`, {
    method: "PATCH",
    headers: socketIdHeaders(),
    body: payload,
  });
}

/** The shared rules an item can name: the book's and the campaign's own. */
export function listItemRules(options: { campaignId?: number; signal?: AbortSignal } = {}) {
  const path = options.campaignId
    ? `/item-rules/?campaign_id=${options.campaignId}`
    : "/item-rules/";
  return apiRequest<ItemRule[]>(path, { signal: options.signal });
}

/** A shared rule of the campaign's own (rules are added, never edited). */
export function createItemRule(payload: {
  name: string;
  summary: string;
  text: string;
  campaign_id: number;
}) {
  return apiRequest<ItemRule>("/item-rules/", {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}
