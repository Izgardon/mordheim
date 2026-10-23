// api
import { apiRequest } from "../../../lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

// types
import type {
  Item,
  ItemCreatePayload,
  ItemProperty,
  ItemUpdatePayload,
  Restriction,
} from "../types/item-types";

type ListItemsOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
  /** Archived entries and book entries removed for the campaign too (`?archived=1`). */
  archived?: boolean;
  signal?: AbortSignal;
};

type ListItemPropertiesOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
  signal?: AbortSignal;
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
  return apiRequest<ItemProperty[]>(path, { signal: options.signal });
}

export function createItemProperty(payload: CreateItemPropertyPayload) {
  return apiRequest<ItemProperty>("/item-properties/", {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function listRestrictions(
  options: { search?: string; campaignId?: number; type?: string } = {}
) {
  const params = new URLSearchParams();
  if (options.search) {
    params.set("search", options.search);
  }
  if (options.type) {
    params.set("type", options.type);
  }
  if (options.campaignId) {
    params.set("campaign_id", String(options.campaignId));
  }
  const query = params.toString();
  const path = query ? `/restrictions/?${query}` : "/restrictions/";
  return apiRequest<Restriction[]>(path);
}
