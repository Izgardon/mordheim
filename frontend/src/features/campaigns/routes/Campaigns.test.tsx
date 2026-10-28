/**
 * The campaigns list and the join code: who sees the code on a campaign card, Copy, and joining
 * with a code (what the dialog sends and how it shows a refusal).
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { handleMembershipNotification } from "@/features/realtime/utils/membership-notifications";
import { campaignFor, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import Campaigns from "./Campaigns";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: 7, email: "aldric@example.com", name: "Aldric" },
    signOut: () => undefined,
  }),
}));

const owned = campaignSummary();
const joined = campaignFor("player", {
  id: 2,
  name: "The Pit Fights",
  join_code: "PIT777",
  player_count: 3,
  max_players: 6,
});

/** A campaign's card, named by its title. */
const card = (name: string) => screen.getByRole("article", { name });

function renderCampaigns() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/campaigns"]}>
      <Campaigns />
    </MemoryRouter>
  );
}

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /campaigns/", [owned, joined]);
});

describe("Campaigns list and the join code", () => {
  it("shows the join code, with Copy, on every campaign you belong to, the ones you only play in too (BUG-143, decision 1b)", async () => {
    const user = setupUser();
    renderCampaigns();

    expect(await screen.findByText("2 campaigns")).toBeInTheDocument();
    expect(card(owned.name)).toHaveTextContent("Join code: WYR123");
    expect(card(joined.name)).toHaveTextContent("Join code: PIT777");

    await user.click(within(card(joined.name)).getByRole("button", { name: "Copy" }));

    expect(await navigator.clipboard.readText()).toBe("PIT777");
    expect(within(card(joined.name)).getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(within(card(owned.name)).getByRole("button", { name: "Copy" })).toBeInTheDocument();
    // Regenerating it is in Settings, for owners and admins.
    expect(screen.queryByRole("button", { name: /new code|regenerate/i })).toBeNull();
  });

  it("opens a campaign from its title, a real link, with no button inside a link (CAMP-UX-07)", async () => {
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/campaigns"]}>
        <Routes>
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<p>Campaign page</p>} />
        </Routes>
      </MemoryRouter>
    );
    const user = setupUser();
    await screen.findByText("2 campaigns");

    const open = within(card(owned.name)).getByRole("link", { name: owned.name });
    expect(open).toHaveAttribute("href", "/campaigns/1");
    for (const link of screen.getAllByRole("link")) {
      expect(within(link).queryByRole("button")).toBeNull();
    }
    expect(
      within(card(owned.name)).getByRole("button", { name: "Roster" }).closest("a")
    ).toBeNull();

    await user.click(open);

    expect(await screen.findByText("Campaign page")).toBeInTheDocument();
  });

  it("joins with the code upper-cased and puts the campaign at the top of the list", async () => {
    const user = setupUser();
    fakeApi.on("GET /campaigns/", [owned]);
    fakeApi.on("POST /campaigns/join/", joined);
    renderCampaigns();
    await screen.findByText("1 campaign");

    await user.click(screen.getByRole("button", { name: "Join" }));
    const dialog = screen.getByRole("dialog", { name: "Join a campaign" });
    await user.type(within(dialog).getByLabelText("Rally code"), "pit777");
    await user.click(within(dialog).getByRole("button", { name: "Join" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.bodyOf("POST /campaigns/join/")).toEqual({ join_code: "PIT777" });
    expect(screen.getByText("2 campaigns")).toBeInTheDocument();
    const campaignLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/campaigns/"));
    expect(campaignLinks.map((link) => link.textContent)).toEqual([
      "The Pit Fights",
      "Shards of the Comet",
    ]);
  });

  it("describes the join, create and roster dialogs to screen readers (BUG-142)", async () => {
    const user = setupUser();
    fakeApi.on(`GET /campaigns/${joined.id}/players/`, []);
    renderCampaigns();
    await screen.findByText("2 campaigns");

    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByRole("dialog", { name: "Join a campaign" })).toHaveAccessibleDescription(
      "Enter the six-character rally code a member of the campaign shared with you."
    );
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(
      screen.getByRole("dialog", { name: "Start a new campaign" })
    ).toHaveAccessibleDescription(
      "Name it, pick its rules and limits, then share its join code with your players."
    );
    await user.keyboard("{Escape}");

    await user.click(within(card(joined.name)).getByRole("button", { name: "Roster" }));
    expect(screen.getByRole("dialog", { name: "Roster" })).toHaveAccessibleDescription(
      "Everyone playing in this campaign."
    );
  });

  it("keeps the dialog open with the server's refusal", async () => {
    const user = setupUser();
    fakeApi.fail(
      "POST /campaigns/join/",
      new ApiError("Already a member", 400, { detail: "Already a member" })
    );
    renderCampaigns();
    await screen.findByText("2 campaigns");

    await user.click(screen.getByRole("button", { name: "Join" }));
    const dialog = screen.getByRole("dialog", { name: "Join a campaign" });
    await user.type(within(dialog).getByLabelText("Rally code"), "wyr123");
    await user.click(within(dialog).getByRole("button", { name: "Join" }));

    expect(await within(dialog).findByText("Already a member")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Rally code")).toHaveValue("wyr123");
    expect(screen.getByText("2 campaigns")).toBeInTheDocument();
  });
});

describe("Archived campaigns (CAMP-NEW-04)", () => {
  it("lists them apart, under Archived, folded until opened", async () => {
    const user = setupUser();
    const archived = campaignSummary({
      id: 3,
      name: "The Drowned Quarter",
      archived_at: "2026-10-20T10:00:00Z",
    });
    fakeApi.on("GET /campaigns/", [owned, joined, archived]);
    renderCampaigns();

    expect(await screen.findByText("2 campaigns")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: archived.name })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Archived (1)" }));

    expect(card(archived.name)).toHaveTextContent("Archived");
    expect(screen.getByRole("button", { name: "Archived (1)" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });
});

describe("Feedback on the campaigns page (CAMP-NEW-08)", () => {
  it("sends a report without campaign fields and thanks you", async () => {
    const user = setupUser();
    fakeApi.on("POST /auth/feedback-report/", { detail: "Feedback report sent." });
    renderCampaigns();
    await screen.findByText("2 campaigns");

    await user.click(screen.getByRole("button", { name: "Send report" }));
    const dialog = screen.getByRole("dialog", { name: "Feedback/Bug Report" });
    await user.type(within(dialog).getByLabelText("Report"), "The list is slow");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Thanks, report sent")).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /auth/feedback-report/")).toEqual({
      report_type: "Bug",
      message: "The list is slow",
    });
  });
});

describe("A campaign you lose from elsewhere (CAMP-TWEAK-04, decision 1)", () => {
  it("drops out of the list at once when it is deleted, or you are removed from it, reading nothing", async () => {
    const { queryClient } = renderCampaigns();
    expect(await screen.findByText("2 campaigns")).toBeInTheDocument();
    const reads = fakeApi.countOf("GET /campaigns/");
    const ctx = {
      queryClient,
      location: { pathname: "/campaigns" },
      navigate: vi.fn(),
      reloadNotifications: vi.fn(),
      currentBattleCampaignId: null,
      clearCurrentBattleSession: vi.fn(),
    };

    act(() => {
      handleMembershipNotification(
        { type: "campaign_deleted", payload: { campaign_id: 2, campaign_name: joined.name } },
        ctx
      );
    });

    await waitFor(() => expect(screen.queryByRole("article", { name: joined.name })).toBeNull());
    expect(screen.getByText("1 campaign")).toBeInTheDocument();

    act(() => {
      handleMembershipNotification(
        { type: "membership_removed", payload: { campaign_id: 1, campaign_name: owned.name } },
        ctx
      );
    });

    await waitFor(() => expect(screen.queryByRole("article", { name: owned.name })).toBeNull());
    expect(fakeApi.countOf("GET /campaigns/")).toBe(reads);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });
});
