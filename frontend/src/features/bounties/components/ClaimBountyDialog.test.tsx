/**
 * Claim a bounty with nothing on record: your units under Heroes, Henchmen and Hired swords in a
 * plain dropdown, and the claim names the one picked.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import type { Bounty } from "../types";
import ClaimBountyDialog from "./ClaimBountyDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ removeBountyClaimNotification: vi.fn() }),
}));

const bounty: Bounty = {
  id: 4,
  campaign_id: 7,
  status: "open",
  amount: 25,
  note: "",
  target: {
    hero_id: 12,
    name: "Grey Seer",
    is_leader: true,
    gone: null,
    warband_id: 20,
    warband_name: "Rats",
    user_id: 2,
  },
  posted_by: { warband_id: 30, warband_name: "Crows", user_id: 3, user_name: "Ada" },
  paid_claim_id: null,
  created_at: "2026-11-01T10:00:00Z",
  closed_at: null,
  claims: [],
};

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /campaigns/7/bounties/4/candidates/", {
    candidates: [],
    units: [
      { kind: "hero", id: 1, name: "Vrask the Hidden", dead: false },
      { kind: "henchmen_group", id: 5, name: "Verminkin Pack", dead: false },
      { kind: "hero", id: 2, name: "Krekk Blackfur", dead: true },
    ],
    battles: [],
  });
  fakeApi.on("POST /campaigns/7/bounties/4/claims/", () => bounty);
});

describe("Claim a bounty", () => {
  it("offers your units under their headings and claims with the one picked", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <ClaimBountyDialog bounty={bounty} open onClose={vi.fn()} campaignId={7} />
    );

    const picker = await screen.findByRole("combobox", {
      name: "Which of your units took Grey Seer out",
    });
    await user.click(picker);
    const heroes = screen.getByRole("group", { name: "Heroes" });
    expect(
      within(heroes)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["Vrask the Hidden", "Krekk Blackfur (dead)"]);
    expect(screen.getByRole("group", { name: "Henchmen" })).toHaveTextContent("Verminkin Pack");
    expect(screen.queryByRole("group", { name: "Hired swords" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await pickOption(user, picker, "Verminkin Pack");
    await user.click(screen.getByRole("button", { name: "Claim it" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /campaigns/7/bounties/4/claims/")).toEqual({
        unit: { kind: "henchmen_group", id: 5 },
      })
    );
  });
});
