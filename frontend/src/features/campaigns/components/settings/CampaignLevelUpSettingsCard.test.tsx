import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CampaignLevelUpSettingsCard from "./CampaignLevelUpSettingsCard";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { CampaignSummary } from "../../types/campaign-types";

const api = vi.hoisted(() => ({ updateCampaign: vi.fn() }));
vi.mock("../../api/campaigns-api", () => api);

const campaign = {
  id: 4,
  name: "Shadows over Mordheim",
  max_heroes: 6,
  max_hired_swords: 3,
  starting_gold: 500,
  hero_level_thresholds: [2, 4, 6],
  henchmen_level_thresholds: [2, 5, 9],
  hired_sword_level_thresholds: [1, 2, 3],
} as CampaignSummary;

describe("CampaignLevelUpSettingsCard", () => {
  it("has no hired-sword table: hired swords level on the heroes' (decision 8)", async () => {
    const user = setupUser();
    api.updateCampaign.mockResolvedValue(campaign);
    renderWithQueryClient(<CampaignLevelUpSettingsCard campaign={campaign} />);

    expect(screen.getByText("Heroes 3 · Henchmen 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Level ups/ }));

    expect(screen.getByText("Hired swords level on this table too.")).toBeInTheDocument();
    expect(screen.queryByText("Hired swords")).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    const saves = screen.getAllByRole("button", { name: "Save" });
    await user.click(saves[saves.length - 1]);

    await waitFor(() =>
      expect(api.updateCampaign).toHaveBeenCalledWith(4, {
        hero_level_thresholds: [2, 4, 6],
        henchmen_level_thresholds: [2, 5, 9],
      })
    );
  });
});
