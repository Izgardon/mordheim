/**
 * Settings → Warband rules' Level-ups: the XP at which heroes, henchmen and hired swords level up
 * (William, 7 Nov 2026: "hired sword max level up options in settings"; "just like the hero and
 * henchman one does"), saved together with one PATCH. Hired swords reset to the book's hero table.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_HERO_LEVEL_THRESHOLDS } from "@/features/warbands/utils/level-thresholds";
import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import CampaignRules from "./CampaignRules";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const campaign = campaignSummary({ hired_sword_level_thresholds: [3, 6, 9] });
const patch = `PATCH /campaigns/${campaign.id}/`;

beforeEach(() => fakeApi.reset());

describe("Level-ups", () => {
  it("edits the hired swords' table beside the heroes' and henchmen's, and saves all three", async () => {
    const user = setupUser();
    fakeApi.on(patch, (body: object) => ({ ...campaign, ...body }));
    renderWithQueryClient(<CampaignRules campaign={campaign} />);
    const field = screen.getByRole("textbox", { name: "Hired swords" });
    expect(field).toHaveValue("3, 6, 9");
    expect(screen.queryByText("Hired swords level on this table too.")).not.toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "12, 4 4");
    await user.click(screen.getByRole("button", { name: "Save level-ups" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf(patch)).toEqual({
        hero_level_thresholds: [2, 4, 6, 8, 11, 14],
        henchmen_level_thresholds: [2, 5, 9, 14],
        hired_sword_level_thresholds: [4, 12],
      })
    );
  });

  it("resets the hired swords to the book's hero table, and refuses a table that isn't numbers", async () => {
    const user = setupUser();
    renderWithQueryClient(<CampaignRules campaign={campaign} />);
    const field = screen.getByRole("textbox", { name: "Hired swords" });
    const resets = screen.getAllByRole("button", { name: "Reset" });

    await user.click(resets[2]);
    expect(field).toHaveValue(DEFAULT_HERO_LEVEL_THRESHOLDS.join(", "));

    await user.clear(field);
    await user.type(field, "two");
    await user.click(screen.getByRole("button", { name: "Save level-ups" }));
    expect(screen.getByText("Use positive whole numbers only.")).toBeInTheDocument();
    expect(fakeApi.calls()).not.toContain(patch);
  });
});
