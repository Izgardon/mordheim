/**
 * The overview's Campaign rules, kept compact (William, 7 Nov 2026: "can live in overview page
 * somewhere"): their titles, each opening to its text on a click; Edit for those who manage them;
 * nothing while there are none.
 */
import { MemoryRouter } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import CampaignRulesSection from "./CampaignRulesSection";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const RULES = "GET /campaigns/1/campaign-rules/";
const curfew = { id: 4, campaign_id: 1, title: "Curfew", body: "No warband leaves.", order: 0 };

const renderSection = (canManage = false) =>
  renderWithQueryClient(
    <MemoryRouter>
      <CampaignRulesSection campaignId={1} canManage={canManage} />
    </MemoryRouter>
  );

beforeEach(() => fakeApi.reset());

describe("The overview's campaign rules", () => {
  it("lists the titles, each opening to its text", async () => {
    fakeApi.on(RULES, [curfew]);
    const user = setupUser();
    renderSection();

    const title = await screen.findByRole("button", { name: "Curfew" });
    expect(screen.queryByText(curfew.body)).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    await user.click(title);

    expect(screen.getByText(curfew.body)).toBeInTheDocument();
    expect(title).toHaveAttribute("aria-expanded", "true");
  });

  it("links those who manage them to the page", async () => {
    fakeApi.on(RULES, [curfew]);
    renderSection(true);

    expect(await screen.findByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/campaigns/1/campaign-rules"
    );
  });

  it("is not there while the campaign has none", async () => {
    fakeApi.on(RULES, []);
    renderSection(true);

    await waitFor(() => expect(fakeApi.calls()).toContain(RULES));
    expect(screen.queryByRole("region", { name: "Campaign rules" })).toBeNull();
  });
});
