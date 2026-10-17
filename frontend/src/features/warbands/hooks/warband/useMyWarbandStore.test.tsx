import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMyWarbandStore } from "./useMyWarbandStore";
import { queryKeys } from "@/lib/query-keys";
import { AppStoreProvider, useAppStore } from "@/stores/app-store";
import { createTestQueryClient } from "@/test/query-test-utils";

const api = vi.hoisted(() => ({ getWarband: vi.fn(), getWarbandSummary: vi.fn() }));
vi.mock("@/features/warbands/api/warbands-api", () => api);
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: 1 } }) }));

const warband = {
  id: 9,
  campaign_id: 7,
  user_id: 1,
  name: "The Black Wolves",
  faction: "Mercenaries",
  created_at: "",
  updated_at: "",
};

const renderStore = (campaignId: number | null) => {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <AppStoreProvider>{children}</AppStoreProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(
    () => {
      useMyWarbandStore(campaignId);
      return useAppStore();
    },
    { wrapper }
  );
  return { queryClient, ...hook };
};

describe("useMyWarbandStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getWarband.mockResolvedValue(warband);
    api.getWarbandSummary.mockResolvedValue({ gold: 120, rating: 99 });
  });

  it("puts your warband, merged with its summary, in the store", async () => {
    const { result } = renderStore(7);

    await waitFor(() =>
      expect(result.current.warband).toEqual({ ...warband, gold: 120, rating: 99 })
    );
    expect(result.current.warbandLoading).toBe(false);
    expect(api.getWarband).toHaveBeenCalledWith(7);
    expect(api.getWarbandSummary).toHaveBeenCalledTimes(1);
  });

  it("follows the cache when the warband page changes the warband", async () => {
    const { result, queryClient } = renderStore(7);
    await waitFor(() => expect(result.current.warband?.gold).toBe(120));

    act(() => {
      queryClient.setQueryData(queryKeys.campaign.myWarband(7), {
        ...warband,
        name: "Grey Wolves",
      });
      queryClient.setQueryData(queryKeys.campaign.warbandSummary(7, 9), { gold: 80, rating: 99 });
    });

    await waitFor(() => expect(result.current.warband?.name).toBe("Grey Wolves"));
    expect(result.current.warband?.gold).toBe(80);
  });

  it("stores null when you have no warband, and the error when loading fails", async () => {
    api.getWarband.mockResolvedValueOnce(null);
    const empty = renderStore(7);
    await waitFor(() => expect(empty.result.current.warbandLoading).toBe(false));
    expect(empty.result.current.warband).toBeNull();
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
    empty.unmount();

    api.getWarband.mockRejectedValueOnce(new Error("Server down"));
    const failed = renderStore(7);
    await waitFor(() => expect(failed.result.current.warbandError).toBe("Server down"));
    expect(failed.result.current.warbandLoading).toBe(false);
  });
});
