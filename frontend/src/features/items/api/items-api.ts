// api
import { apiRequest } from "../../../lib/api-client";

// types
import type { Item, ItemCreatePayload } from "../types/item-types";

type ListItemsOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
};

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
  const query = params.toString();
  const path = query ? `/items/?${query}` : "/items/";
  return apiRequest<Item[]>(path);
}

export function createItem(payload: ItemCreatePayload) {
  return apiRequest<Item>("/items/", {
    method: "POST",
    body: payload,
  });
}




