import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCatalogueCache } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";
import { createQueryWrapper, createTestQueryClient } from "@/test/query-test-utils";
import { useCampaignItems } from "./useCampaignItems";
import { useCampaignSpecial } from "./useCampaignSpecial";
import { listItems } from "@/features/items/api/items-api";
import { listSpecial } from "@/features/special/api/special-api";

import type { Item } from "@/features/items/types/item-types";
import type { Special } from "@/features/special/types/special-types";

vi.mock("@/features/items/api/items-api", () => ({
  listItems: vi.fn(),
  listItemProperties: vi.fn(),
}));

vi.mock("@/features/special/api/special-api", () => ({
  listSpecial: vi.fn(),
}));

describe("campaign catalog hooks", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(listSpecial).mockReset();
  });

  it("loads a catalogue once and shares it between components", async () => {
    vi.mocked(listItems).mockResolvedValue([
      { id: 1, name: "Bow" } as Item,
      { id: 2, name: "Helmet" } as Item,
    ]);
    const wrapper = createQueryWrapper(createTestQueryClient());

    const { result } = renderHook(
      () => ({
        warband: useCampaignItems({ campaignId: 7, hasCampaignId: true }),
        dialog: useCampaignItems({ campaignId: 7, hasCampaignId: true }),
      }),
      { wrapper }
    );

    expect(result.current.warband.isItemsLoading).toBe(true);
    await waitFor(() => expect(result.current.warband.availableItems).toHaveLength(2));
    expect(result.current.dialog.availableItems).toBe(result.current.warband.availableItems);
    expect(listItems).toHaveBeenCalledTimes(1);
    expect(listItems).toHaveBeenCalledWith({ campaignId: 7, signal: expect.any(AbortSignal) });
  });

  it("shows a created entry immediately, then refetches the list", async () => {
    vi.mocked(listSpecial).mockResolvedValueOnce([]);
    const wrapper = createQueryWrapper(createTestQueryClient());

    const { result } = renderHook(
      () => ({
        catalog: useCampaignSpecial({ campaignId: 12, hasCampaignId: true }),
        cache: useCatalogueCache(),
      }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.catalog.isSpecialsLoading).toBe(false));

    const created = { id: 44, name: "Large", type: "Trait" } as Special;
    // The background refetch never answers, so the entry can only come from the cache write.
    vi.mocked(listSpecial).mockReturnValueOnce(new Promise<Special[]>(() => undefined));
    act(() => {
      result.current.cache.upsert("specials", 12, created);
    });

    await waitFor(() => expect(result.current.catalog.availableSpecials).toEqual([created]));
    expect(listSpecial).toHaveBeenCalledTimes(2);
  });

  it("does not fetch without a campaign", () => {
    const wrapper = createQueryWrapper(createTestQueryClient());

    const { result } = renderHook(
      () => useCampaignItems({ campaignId: Number.NaN, hasCampaignId: false }),
      { wrapper }
    );

    expect(result.current.availableItems).toEqual([]);
    expect(result.current.isItemsLoading).toBe(false);
    expect(listItems).not.toHaveBeenCalled();
  });
});

describe("campaign catalog hooks after a failed refetch", () => {
  it("keeps showing the cached list instead of an error", async () => {
    vi.mocked(listItems).mockReset();
    vi.mocked(listItems).mockResolvedValueOnce([{ id: 1, name: "Bow" } as Item]);
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useCampaignItems({ campaignId: 7, hasCampaignId: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.availableItems).toHaveLength(1));

    // e.g. the tab regains focus while the phone is offline
    vi.mocked(listItems).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(() => queryClient.refetchQueries());
    expect(queryClient.getQueryState(queryKeys.campaign.catalogue(7, "items"))?.status).toBe(
      "error"
    );
    // Let the observer deliver the failed state before asserting what the hook exposes.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

    expect(result.current.itemsError).toBe("");
    expect(result.current.availableItems).toEqual([{ id: 1, name: "Bow" }]);
  });

  it("shows the error when the list never loaded", async () => {
    vi.mocked(listItems).mockReset();
    vi.mocked(listItems).mockRejectedValueOnce(new Error("Server exploded"));
    const wrapper = createQueryWrapper(createTestQueryClient());

    const { result } = renderHook(() => useCampaignItems({ campaignId: 7, hasCampaignId: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.itemsError).toBe("Server exploded"));
  });
});
