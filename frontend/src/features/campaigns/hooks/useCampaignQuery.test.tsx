import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper, createTestQueryClient } from "@/test/query-test-utils";
import { getCampaign } from "../api/campaigns-api";
import { useCampaignCapabilities } from "../capabilities";
import { useCampaignQuery, useSetCampaign, writeCampaignAnswer } from "./useCampaignQuery";

import type { CampaignSummary } from "../types/campaign-types";

vi.mock("../api/campaigns-api", () => ({ getCampaign: vi.fn() }));

const campaign = {
  id: 7,
  name: "Shards of the Comet",
  role: "player",
  in_progress: false,
  permissions: ["add_custom", "manage_items"],
  capabilities: { add_custom: true, manage_items: true },
} as CampaignSummary;

describe("useCampaignQuery", () => {
  beforeEach(() => {
    vi.mocked(getCampaign).mockReset();
    vi.mocked(getCampaign).mockResolvedValue(campaign);
  });

  it("reads the capabilities from the campaign payload, sharing one request", async () => {
    const wrapper = createQueryWrapper(createTestQueryClient());

    const { result } = renderHook(
      () => ({ layout: useCampaignQuery(7), page: useCampaignCapabilities(7) }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.page.add_custom).toBe(true));
    expect(result.current.page.manage_items).toBe(true);
    expect(result.current.page.manage_rules).toBe(false);
    expect(getCampaign).toHaveBeenCalledTimes(1);
    expect(getCampaign).toHaveBeenCalledWith(7, { signal: expect.any(AbortSignal) });
  });

  it("has no capabilities until the campaign loads", () => {
    vi.mocked(getCampaign).mockImplementation(() => new Promise(() => undefined));
    const wrapper = createQueryWrapper(createTestQueryClient());

    const { result } = renderHook(() => useCampaignCapabilities(7), { wrapper });

    expect(Object.values(result.current).some(Boolean)).toBe(false);
  });

  it("keeps the caller's permissions and capabilities when a settings update replaces the campaign", async () => {
    const wrapper = createQueryWrapper(createTestQueryClient());
    const { result } = renderHook(
      () => ({ query: useCampaignQuery(7), setCampaign: useSetCampaign(7) }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.query.data).toEqual(campaign));

    // PATCH /campaigns/:id/ answers without the permissions and capabilities fields.
    const {
      permissions: _omitted,
      capabilities: _flags,
      ...updated
    } = { ...campaign, in_progress: true };
    act(() => result.current.setCampaign(updated));

    await waitFor(() => expect(result.current.query.data?.in_progress).toBe(true));
    expect(result.current.query.data?.permissions).toEqual(["add_custom", "manage_items"]);
    expect(result.current.query.data?.capabilities).toEqual(campaign.capabilities);
  });
});

describe("writeCampaignAnswer", () => {
  const key = ["campaign", 7, "detail"];

  it("keeps the cached permissions and capabilities, reading nothing again", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(key, campaign);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    writeCampaignAnswer(queryClient, 7, {
      ...campaign,
      permissions: undefined,
      capabilities: undefined,
      name: "Renamed",
    });

    expect(queryClient.getQueryData<CampaignSummary>(key)).toMatchObject({
      name: "Renamed",
      permissions: campaign.permissions,
      capabilities: campaign.capabilities,
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("reads the campaign again when the answer switches a page on or off (its flags depend on it)", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(key, { ...campaign, enable_encampments: false });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    writeCampaignAnswer(queryClient, 7, {
      ...campaign,
      capabilities: undefined,
      enable_encampments: true,
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: key, exact: true });
  });
});
