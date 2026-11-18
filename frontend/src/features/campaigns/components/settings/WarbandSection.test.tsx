/**
 * Settings → Your warband: the Leave campaign card. The button says Leave (William, 18 Nov 2026,
 * from his phone: "The leave campaign button doesn't need that long text") and what leaving does
 * stays in the card's own text, which is a lossy-action warning.
 */
import { MemoryRouter } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";

import WarbandSection from "./WarbandSection";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));
// no warband of your own: the section is the "Your warband" card and Leave campaign
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({
    warband: null,
    warbandLoading: false,
    currentBattleSession: null,
    clearCurrentBattleSession: vi.fn(),
  }),
}));

const show = (campaign = campaignSummary({ player_count: 1 })) =>
  renderWithQueryClient(
    <MemoryRouter>
      <WarbandSection campaign={campaign} />
    </MemoryRouter>
  );

beforeEach(() => {
  fakeApi.reset();
});

describe("Leave campaign", () => {
  it("offers Leave, the archiving it does being the card's text", () => {
    show();

    const card = screen.getByRole("region", { name: "Leave campaign" });

    expect(within(card).getByRole("button")).toHaveAccessibleName("Leave");
    expect(card).toHaveTextContent(
      "You're the only member, so leaving archives the campaign. You stay its owner and can restore it."
    );
  });

  it("greys the button for an owner with company, who hands the campaign over first", () => {
    show(campaignSummary({ player_count: 3 }));

    const card = screen.getByRole("region", { name: "Leave campaign" });

    expect(within(card).getByRole("button", { name: "Leave" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(card).toHaveTextContent("Hand ownership to an admin first");
  });
});
