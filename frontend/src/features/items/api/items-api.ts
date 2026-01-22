import { apiRequest } from "../../../lib/api-client";
import type { Item, ItemCreatePayload } from "../types/item-types";

type ListItemsOptions = {
  type?: string;
  search?: string;
};

export function listItems(token: string, options: ListItemsOptions = {}) {
  const params = new URLSearchParams();
  if (options.type) {
    params.set("type", options.type);
  }
  if (options.search) {
    params.set("search", options.search);
  }
  const query = params.toString();
  const path = query ? `/items/?${query}` : "/items/";
  return apiRequest<Item[]>(path, { token });
}

export function createItem(token: string, payload: ItemCreatePayload) {
  return apiRequest<Item>("/items/", {
    method: "POST",
    body: payload,
    token,
  });
}
