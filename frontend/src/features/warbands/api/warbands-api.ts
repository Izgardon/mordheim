// api
import { apiRequest } from "../../../lib/api-client";

// types
import type {
  HenchmenGroup,
  HenchmenGroupPayload,
  Warband,
  WarbandCreatePayload,
  WarbandHero,
  WarbandHeroPayload,
  WarbandItemSummary,
  WarbandLog,
  WarbandLogCreatePayload,
  WarbandResource,
  WarbandTrade,
  WarbandTradePayload,
  WarbandUpdatePayload,
} from "../types/warband-types";

type WarbandUpdateDetail = {
  warbandId: number;
};

function emitWarbandUpdate(warbandId: number) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<WarbandUpdateDetail>("warband:updated", {
      detail: { warbandId },
    })
  );
}

type WarbandUpdateOptions = {
  emitUpdate?: boolean;
};

export async function getWarband(campaignId: number) {
  const data = await apiRequest<Warband[]>(
    `/warbands/?campaign_id=${encodeURIComponent(campaignId)}`
  );
  return data[0] ?? null;
}

export function getWarbandById(warbandId: number) {
  return apiRequest<Warband>(`/warbands/${warbandId}/`);
}

export function getWarbandSummary(warbandId: number) {
  return apiRequest<Warband>(`/warbands/${warbandId}/summary/`);
}

export function createWarband(campaignId: number, payload: WarbandCreatePayload) {
  return apiRequest<Warband>("/warbands/", {
    method: "POST",
    body: {
      ...payload,
      campaign_id: campaignId,
    },
  }).then((data) => {
    if (data?.id) {
      emitWarbandUpdate(data.id);
    }
    return data;
  });
}

export function updateWarband(
  warbandId: number,
  payload: Partial<WarbandUpdatePayload>,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<Warband>(`/warbands/${warbandId}/`, {
    method: "PATCH",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function deleteWarband(warbandId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/`, {
    method: "DELETE",
  }).then((data) => {
    emitWarbandUpdate(warbandId);
    return data;
  });
}

export function listWarbandHeroes(warbandId: number) {
  return apiRequest<WarbandHero[]>(`/warbands/${warbandId}/heroes/`, {
  });
}

export function listWarbandItems(warbandId: number) {
  return apiRequest<WarbandItemSummary[]>(`/warbands/${warbandId}/items/`);
}

export function removeWarbandItem(
  warbandId: number,
  itemId: number,
  quantity = 1
) {
  return apiRequest<void>(`/warbands/${warbandId}/items/${itemId}/`, {
    method: "DELETE",
    body: { quantity },
  }).then((data) => {
    emitWarbandUpdate(warbandId);
    return data;
  });
}

export function addWarbandItem(
  warbandId: number,
  itemId: number
) {
  return apiRequest<WarbandItemSummary>(`/warbands/${warbandId}/items/`, {
    method: "POST",
    body: {
      item_id: itemId,
    },
  }).then((data) => {
    emitWarbandUpdate(warbandId);
    return data;
  });
}

export function getWarbandHeroDetail(warbandId: number, heroId: number) {
  return apiRequest<WarbandHero>(`/warbands/${warbandId}/heroes/${heroId}/`);
}

export function listWarbandHeroDetails(warbandId: number) {
  return apiRequest<WarbandHero[]>(`/warbands/${warbandId}/heroes/detail/`);
}

export function createWarbandHero(
  warbandId: number,
  payload: WarbandHeroPayload,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<WarbandHero>(`/warbands/${warbandId}/heroes/`, {
    method: "POST",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function updateWarbandHero(
  warbandId: number,
  heroId: number,
  payload: WarbandHeroPayload
) {
  return apiRequest<WarbandHero>(`/warbands/${warbandId}/heroes/${heroId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteWarbandHero(
  warbandId: number,
  heroId: number,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<void>(`/warbands/${warbandId}/heroes/${heroId}/`, {
    method: "DELETE",
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function listWarbandLogs(warbandId: number, feature?: string) {
  const params = new URLSearchParams();
  if (feature) {
    params.set("feature", feature);
  }
  const query = params.toString();
  const path = query
    ? `/warbands/${warbandId}/logs/?${query}`
    : `/warbands/${warbandId}/logs/`;
  return apiRequest<WarbandLog[]>(path);
}

export function createWarbandLog(
  warbandId: number,
  payload: WarbandLogCreatePayload
) {
  return apiRequest<WarbandLog>(`/warbands/${warbandId}/logs/`, {
    method: "POST",
    body: payload,
  }).then((data) => {
    emitWarbandUpdate(warbandId);
    return data;
  });
}

export function levelUpWarbandHero(
  warbandId: number,
  heroId: number,
  payload: Record<string, unknown>
) {
  return apiRequest<WarbandHero>(
    `/warbands/${warbandId}/heroes/${heroId}/level-up/`,
    {
      method: "POST",
      body: { payload },
    }
  );
}

export function createWarbandResource(
  warbandId: number,
  payload: { name: string },
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<WarbandResource>(`/warbands/${warbandId}/resources/`, {
    method: "POST",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function updateWarbandResource(
  warbandId: number,
  resourceId: number,
  payload: { amount: number },
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<WarbandResource>(`/warbands/${warbandId}/resources/${resourceId}/`, {
    method: "PATCH",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function deleteWarbandResource(
  warbandId: number,
  resourceId: number,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<void>(`/warbands/${warbandId}/resources/${resourceId}/`, {
    method: "DELETE",
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function listWarbandTrades(warbandId: number) {
  return apiRequest<WarbandTrade[]>(`/warbands/${warbandId}/trades/`);
}

export function createWarbandTrade(warbandId: number, payload: WarbandTradePayload) {
  return apiRequest<WarbandTrade>(`/warbands/${warbandId}/trades/`, {
    method: "POST",
    body: payload,
  }).then((data) => {
    emitWarbandUpdate(warbandId);
    return data;
  });
}

// Henchmen Groups

export function listWarbandHenchmenGroups(warbandId: number) {
  return apiRequest<HenchmenGroup[]>(`/warbands/${warbandId}/henchmen-groups/`);
}

export function getWarbandHenchmenGroupDetail(warbandId: number, groupId: number) {
  return apiRequest<HenchmenGroup>(`/warbands/${warbandId}/henchmen-groups/${groupId}/`);
}

export function levelUpWarbandHenchmenGroup(
  warbandId: number,
  groupId: number,
  payload: Record<string, unknown>
) {
  return apiRequest<HenchmenGroup>(`/warbands/${warbandId}/henchmen-groups/${groupId}/level-up/`, {
    method: "POST",
    body: { payload },
  });
}

export function createWarbandHenchmenGroup(
  warbandId: number,
  payload: HenchmenGroupPayload,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<HenchmenGroup>(`/warbands/${warbandId}/henchmen-groups/`, {
    method: "POST",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function updateWarbandHenchmenGroup(
  warbandId: number,
  groupId: number,
  payload: HenchmenGroupPayload
) {
  return apiRequest<HenchmenGroup>(`/warbands/${warbandId}/henchmen-groups/${groupId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteWarbandHenchmenGroup(
  warbandId: number,
  groupId: number,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<void>(`/warbands/${warbandId}/henchmen-groups/${groupId}/`, {
    method: "DELETE",
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}


