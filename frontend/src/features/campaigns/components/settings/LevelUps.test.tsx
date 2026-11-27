/**
 * Settings → Rules → Level-ups: the XP at which heroes, henchmen and hired swords level up
 * (William, 7 Nov 2026: "hired sword max level up options in settings"), folded under how many
 * levels each table holds and saved together with one PATCH. Hired swords reset to the henchmen
 * table: "hired swords level up like henchmen so get the same levels and gaps as them by default"
 * (William, 12 Nov 2026).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_HENCHMEN_LEVEL_THRESHOLDS } from "@/features/warbands/utils/level-thresholds";
import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import LevelUps from "./LevelUps";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const campaign = campaignSummary({ hired_sword_level_thresholds: [3, 6, 9] });
const patch = `PATCH /campaigns/${campaign.id}/`;

const show = async (user: ReturnType<typeof setupUser>) => {
  renderWithQueryClient(<LevelUps campaign={campaign} />);
  await user.click(screen.getByRole("button", { name: /^Level-ups/ }));
};

beforeEach(() => fakeApi.reset());

describe("Level-ups", () => {
  it("is folded under how many levels each table holds", () => {
    renderWithQueryClient(<LevelUps campaign={campaign} />);

    const fold = screen.getByRole("button", { name: /^Level-ups/ });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(fold).toHaveTextContent("for henchmen, 3 for hired swords");
  });

  it("keeps the buttons in their own row under the fields, not in the grid's last cell", async () => {
    // William, 12 Nov 2026: "level-ups as they are but in a 2x2 grid with the buttons in their own
    // row underneath" — with three fields the Save used to sit in the grid's fourth cell.
    await show(setupUser());
    const fields = screen.getByRole("textbox", { name: "Heroes" }).closest("div.grid");
    const save = screen.getByRole("button", { name: "Save level-ups" });

    expect(fields).toContainElement(screen.getByRole("textbox", { name: "Hired swords" }));
    expect(fields).not.toContainElement(save);
    expect(fields!.compareDocumentPosition(save)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("edits the hired swords' table beside the heroes' and henchmen's, and saves all three", async () => {
    const user = setupUser();
    fakeApi.on(patch, (body: object) => ({ ...campaign, ...body }));
    await show(user);
    const field = screen.getByRole("textbox", { name: "Hired swords" });
    expect(field).toHaveValue("3, 6, 9");

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

  it("resets the hired swords to the henchmen table, and refuses a table that isn't numbers", async () => {
    const user = setupUser();
    await show(user);
    const field = screen.getByRole("textbox", { name: "Hired swords" });
    // the Reset beside the field (the wyrdstone sell prices have one too)
    const reset = within(field.parentElement as HTMLElement).getByRole("button", { name: "Reset" });

    await user.click(reset);
    expect(field).toHaveValue(DEFAULT_HENCHMEN_LEVEL_THRESHOLDS.join(", "));

    await user.clear(field);
    await user.type(field, "two");
    await user.click(screen.getByRole("button", { name: "Save level-ups" }));
    expect(screen.getByText("Use positive whole numbers only.")).toBeInTheDocument();
    expect(fakeApi.calls()).not.toContain(patch);
  });
});
