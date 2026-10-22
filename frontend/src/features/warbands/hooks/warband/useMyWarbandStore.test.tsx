import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMyWarbandStore, useMyWarbandWriter } from "./useMyWarbandStore";
import { mergeSheetUpdate } from "../../api/warband-cache";
import { queryKeys } from "@/lib/query-keys";
import { AppStoreProvider, useAppStore } from "@/stores/app-store";
import { createTestQueryClient } from "@/test/query-test-utils";

import type { WarbandSheet } from "../../types/warband-sheet";

const api = vi.hoisted(() => ({
  getWarband: vi.fn(),
  getWarbandSheet: vi.fn(),
  getWarbandSummary: vi.fn(),
}));
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

const sheet = {
  warband,
  summary: { gold: 120, rating: 99 },
  capabilities: {},
  heroes: [{ id: 1, name: "Aldric", xp: 3 }],
  henchmen_groups: [],
  hirelings: [],
} as unknown as WarbandSheet;

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
      return { ...useAppStore(), writer: useMyWarbandWriter(campaignId) };
    },
    { wrapper }
  );
  return { queryClient, ...hook };
};

describe("useMyWarbandStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getWarband.mockResolvedValue(warband);
    api.getWarbandSheet.mockResolvedValue(sheet);
  });

  it("puts your warband, merged with its summary, in the store from the shared sheet", async () => {
    const { result } = renderStore(7);

    await waitFor(() =>
      expect(result.current.warband).toEqual({ ...warband, gold: 120, rating: 99 })
    );
    expect(result.current.warbandLoading).toBe(false);
    expect(api.getWarband).toHaveBeenCalledWith(7);
    expect(api.getWarbandSheet).toHaveBeenCalledTimes(1);
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
  });

  it("follows the cache when the warband page changes the warband", async () => {
    const { result, queryClient } = renderStore(7);
    await waitFor(() => expect(result.current.warband?.gold).toBe(120));

    act(() => {
      queryClient.setQueryData<WarbandSheet>(
        queryKeys.campaign.warbandSheet(7, 9),
        (current: WarbandSheet | undefined) =>
          current
            ? {
                ...current,
                warband: { ...current.warband, name: "Grey Wolves" },
                summary: { gold: 80, rating: 99 },
              }
            : current
      );
    });

    await waitFor(() => expect(result.current.warband?.name).toBe("Grey Wolves"));
    expect(result.current.warband?.gold).toBe(80);
  });

  it("keeps the stored warband when only a unit row changes", async () => {
    const { result, queryClient } = renderStore(7);
    await waitFor(() => expect(result.current.warband?.gold).toBe(120));
    const stored = result.current.warband;

    act(() => {
      queryClient.setQueryData<WarbandSheet>(
        queryKeys.campaign.warbandSheet(7, 9),
        (current: WarbandSheet | undefined) =>
          current ? mergeSheetUpdate(current, { heroes: [{ id: 1, xp: 4 } as never] }) : current
      );
    });

    expect(result.current.warband).toBe(stored);
  });

  it("stores null when you have no warband, and the error when loading fails", async () => {
    api.getWarband.mockResolvedValueOnce(null);
    const empty = renderStore(7);
    await waitFor(() => expect(empty.result.current.warbandLoading).toBe(false));
    expect(empty.result.current.warband).toBeNull();
    expect(api.getWarbandSheet).not.toHaveBeenCalled();
    empty.unmount();

    api.getWarband.mockRejectedValueOnce(new Error("Server down"));
    const failed = renderStore(7);
    await waitFor(() => expect(failed.result.current.warbandError).toBe("Server down"));
    expect(failed.result.current.warbandLoading).toBe(false);
  });

  it("takes settings writes from the cache, so the store keeps one writer", async () => {
    const { result } = renderStore(7);
    await waitFor(() => expect(result.current.warband?.gold).toBe(120));

    act(() => result.current.writer.merge(9, { dice_color: "#ff0000", gold: 90 }));

    await waitFor(() => expect(result.current.warband?.dice_color).toBe("#ff0000"));
    expect(result.current.warband?.gold).toBe(90);

    act(() => result.current.writer.remove(9));

    await waitFor(() => expect(result.current.warband).toBeNull());
  });
});
