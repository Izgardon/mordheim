// api
import { apiRequest } from "../../../lib/api-client";

// types
import type {
  Item,
  ItemCreatePayload,
  ItemProperty,
  ItemUpdatePayload,
} from "../types/item-types";

type ListItemsOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
};

type ListItemPropertiesOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
};

type CreateItemPropertyPayload = {
  name: string;
  description: string;
  type: string;
  campaign_id: number;
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

export function updateItem(itemId: number, payload: ItemUpdatePayload) {
  return apiRequest<Item>(`/items/${itemId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteItem(itemId: number) {
  return apiRequest<void>(`/items/${itemId}/`, {
    method: "DELETE",
  });
}

export function listItemProperties(options: ListItemPropertiesOptions = {}) {
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
  const path = query ? `/item-properties/?${query}` : "/item-properties/";
  return apiRequest<ItemProperty[]>(path);
}

export function createItemProperty(payload: CreateItemPropertyPayload) {
  return apiRequest<ItemProperty>("/item-properties/", {
    method: "POST",
    body: payload,
  });
}
