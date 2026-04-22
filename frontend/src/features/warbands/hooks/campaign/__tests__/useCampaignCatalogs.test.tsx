import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { AppStoreProvider, useAppStore } from "@/stores/app-store";
import { useCampaignItems } from "../useCampaignItems";
import { useCampaignSpecial } from "../useCampaignSpecial";
import { listItems } from "@/features/items/api/items-api";
import { listSpecial } from "@/features/special/api/special-api";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/features/items/api/items-api", () => ({
  listItems: vi.fn(),
}));

vi.mock("@/features/special/api/special-api", () => ({
  listSpecial: vi.fn(),
}));

function createWrapper() {
  return function Wrapper({ children }: PropsWithChildren) {
    return <AppStoreProvider>{children}</AppStoreProvider>;
  };
}

describe("campaign catalog hooks", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(listSpecial).mockReset();
  });

  it("loadItems writes fetched data into the shared cache", async () => {
    vi.mocked(listItems).mockResolvedValue([
      { id: 1, name: "Bow" } as any,
      { id: 2, name: "Helmet" } as any,
    ]);

    const { result } = renderHook(
      () => ({
        catalog: useCampaignItems({ campaignId: 7, hasCampaignId: true, auto: false }),
        store: useAppStore(),
      }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.catalog.loadItems();
    });

    expect(listItems).toHaveBeenCalledWith({ campaignId: 7 });
    expect(result.current.catalog.availableItems).toEqual([
      { id: 1, name: "Bow" },
      { id: 2, name: "Helmet" },
    ]);
    expect(result.current.store.itemsCache["campaign:7"]).toEqual({
      loaded: true,
      data: [
        { id: 1, name: "Bow" },
        { id: 2, name: "Helmet" },
      ],
    });
  });

  it("exposes special cache upserts immediately without a reload", async () => {
    const { result } = renderHook(
      () => ({
        catalog: useCampaignSpecial({ campaignId: 12, hasCampaignId: true, auto: false }),
        store: useAppStore(),
      }),
      { wrapper: createWrapper() }
    );

    expect(result.current.catalog.availableSpecials).toEqual([]);

    act(() => {
      result.current.store.upsertSpecialCache("campaign:12", {
        id: 44,
        name: "Large",
        type: "Trait",
      } as any);
    });

    await waitFor(() => {
      expect(result.current.catalog.availableSpecials).toEqual([
        { id: 44, name: "Large", type: "Trait" },
      ]);
    });
  });
});
