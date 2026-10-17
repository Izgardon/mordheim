import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listCampaignBattleHistory,
  listCampaignBulletinEntries,
  listCampaignPivotalMoments,
  listCampaignPlayers,
  listCampaignTopKillers,
  listCampaignTradeRequests,
} from "../api/campaigns-api";
import { useCampaignOverview } from "./useCampaignOverview";

vi.mock("@/stores/app-store", () => ({ useAppStore: () => ({ setCampaignStarted: vi.fn() }) }));
vi.mock("../api/campaigns-api", () => ({
  createCampaignBulletinEntry: vi.fn(),
  deleteCampaignBulletinEntry: vi.fn(),
  listCampaignBattleHistory: vi.fn(async () => []),
  listCampaignBulletinEntries: vi.fn(async () => []),
  listCampaignPivotalMoments: vi.fn(async () => []),
  listCampaignPlayers: vi.fn(async () => []),
  listCampaignTopKillers: vi.fn(async () => ({ top_killers: [] })),
  listCampaignTradeRequests: vi.fn(async () => []),
  updateCampaign: vi.fn(),
}));

describe("useCampaignOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the overview tab without the hidden bulletin tab's data (PERF-43)", async () => {
    renderHook(() => useCampaignOverview({ campaignId: 7, campaign: null, activeTab: "overview" }));

    await waitFor(() => expect(listCampaignPlayers).toHaveBeenCalledWith(7));
    expect(listCampaignTradeRequests).toHaveBeenCalled();
    expect(listCampaignBattleHistory).toHaveBeenCalled();
    expect(listCampaignPivotalMoments).toHaveBeenCalled();
    expect(listCampaignTopKillers).not.toHaveBeenCalled();
    expect(listCampaignBulletinEntries).not.toHaveBeenCalled();
  });

  it("loads the bulletin and top killers when the bulletin tab is open", async () => {
    const { result } = renderHook(() =>
      useCampaignOverview({ campaignId: 7, campaign: null, activeTab: "bulletin" })
    );

    await waitFor(() => expect(result.current.isBulletinLoading).toBe(false));
    expect(listCampaignTopKillers).toHaveBeenCalledWith(7);
    expect(listCampaignBulletinEntries).toHaveBeenCalledWith(7);
  });
});
