/**
 * The campaign rules under the overview's info bar (William, 8 Nov 2026: "lets move the campaign
 * rules underneath the info bar like in the warband page but on overview"): a pill per rule beside
 * Campaign rules, which opens them all in a modal; a pill opens it at its rule. Edit for those who
 * manage them; nothing while there are none.
 */
import { MemoryRouter } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import CampaignRulesRow from "./CampaignRulesRow";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const RULES = "GET /campaigns/1/campaign-rules/";
const curfew = { id: 4, campaign_id: 1, title: "Curfew", body: "No warband leaves.", order: 0 };
const tolls = { id: 5, campaign_id: 1, title: "Bridge tolls", body: "5 gc a crossing.", order: 1 };

const renderRow = (canManage = false) =>
  renderWithQueryClient(
    <MemoryRouter>
      <CampaignRulesRow campaignId={1} campaignName="The Shattered Crown" canManage={canManage} />
    </MemoryRouter>
  );

beforeEach(() => fakeApi.reset());

describe("The overview's campaign rules", () => {
  it("shows a pill per rule, and a pill opens the modal at its rule", async () => {
    fakeApi.on(RULES, [curfew, tolls]);
    const user = setupUser();
    renderRow();

    const row = await screen.findByRole("region", { name: "Campaign rules" });
    expect(
      within(row)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Campaign rules", "Curfew", "Bridge tolls"]);
    expect(screen.queryByText(curfew.body)).toBeNull();
    expect(within(row).queryByRole("link", { name: "Edit" })).toBeNull();
    await user.click(within(row).getByRole("button", { name: "Bridge tolls" }));

    const dialog = await screen.findByRole("dialog", { name: "Campaign rules" });
    expect(within(dialog).getByRole("article", { name: "Bridge tolls" })).toHaveAttribute(
      "data-opened"
    );
    expect(within(dialog).getByRole("article", { name: "Curfew" })).not.toHaveAttribute(
      "data-opened"
    );
    expect(dialog).toHaveTextContent("5 gc a crossing.");
    expect(dialog).toHaveTextContent("No warband leaves.");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens them all from Campaign rules", async () => {
    fakeApi.on(RULES, [curfew, tolls]);
    const user = setupUser();
    renderRow();

    await user.click(await screen.findByRole("button", { name: "Campaign rules" }));

    const dialog = await screen.findByRole("dialog", { name: "Campaign rules" });
    expect(within(dialog).getAllByRole("article")).toHaveLength(2);
    expect(dialog.querySelector("[data-opened]")).toBeNull();
  });

  it("links those who manage them to the Campaign rules page", async () => {
    fakeApi.on(RULES, [curfew]);
    renderRow(true);

    const row = await screen.findByRole("region", { name: "Campaign rules" });
    expect(within(row).getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/campaigns/1/campaign-rules"
    );
  });

  it("is not there while the campaign has none", async () => {
    fakeApi.on(RULES, []);
    renderRow(true);

    await waitFor(() => expect(fakeApi.calls()).toContain(RULES));
    expect(screen.queryByRole("region", { name: "Campaign rules" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });
});
