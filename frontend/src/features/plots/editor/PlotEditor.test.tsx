/**
 * The custom-plot editor: it sends the plot whole (its scoring and its ladder) and shows what the
 * server says the plot is missing as warnings, never a refusal.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import PlotEditor from "./PlotEditor";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));

const CAMPAIGN_ID = 1;
const saved = {
  id: 5,
  name: "The Lost Cargo",
  summary: "",
  who_text: "",
  variant_of: "",
  no_alliance_with: [],
  campaign_id: CAMPAIGN_ID,
  setting_id: null,
  scoring: [],
  achievements: [],
  warnings: ["Nothing says who may follow this plot."],
};

beforeEach(() => {
  fakeApi.reset();
  vi.mocked(toast.warning).mockClear();
  fakeApi.on("POST /plots/", saved);
});

describe("The plot editor", () => {
  it("sends the plot with its scoring and the book's seven rungs, and warns about what is missing", async () => {
    const user = setupUser();
    const onClose = vi.fn();
    renderWithQueryClient(
      <PlotEditor campaignId={CAMPAIGN_ID} plotId={null} canDelete onClose={onClose} />
    );

    await user.type(screen.getByRole("textbox", { name: "Plot name" }), "The Lost Cargo");
    await user.type(screen.getByRole("textbox", { name: "Scoring 1 points" }), "2");
    await user.type(screen.getByRole("textbox", { name: "Scoring 1 text" }), "A crate recovered.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const body = fakeApi.bodyOf("POST /plots/") as Record<string, unknown>;
    expect(body.campaign_id).toBe(CAMPAIGN_ID);
    expect(body.scoring).toEqual([{ points: 2, dice: "", text: "A crate recovered." }]);
    expect((body.achievements as { points: number }[]).map((rung) => rung.points)).toEqual([
      5, 10, 15, 20, 25, 35, 40,
    ]);
    expect(toast.warning).toHaveBeenCalledWith("Nothing says who may follow this plot.");
  });
});
