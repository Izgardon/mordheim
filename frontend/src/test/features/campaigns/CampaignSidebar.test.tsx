// routing
import { MemoryRouter } from "react-router-dom";

// types
import type { CampaignSummary } from "../../../features/campaigns/types/campaign-types";

// other
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CampaignSidebar from "../../../features/campaigns/components/CampaignSidebar";

const campaign: CampaignSummary = {
  id: 1,
  name: "Shards of the Comet",
  campaign_type: "standard",
  join_code: "ABC123",
  max_players: 6,
  player_count: 1,
  role: "owner",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const navItems = [
  { label: "Chronicle", path: "" },
  { label: "Skills", path: "skills" },
];

describe("CampaignSidebar", () => {
  it("shows settings when the user is an owner", () => {
    render(
      <MemoryRouter initialEntries={["/campaigns/1"]}>
        <CampaignSidebar
          campaign={campaign}
          campaignId="1"
          isOwner
          onSignOut={() => {}}
          navItems={navItems}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("hides settings for non-owners", () => {
    render(
      <MemoryRouter initialEntries={["/campaigns/1"]}>
        <CampaignSidebar
          campaign={campaign}
          campaignId="1"
          isOwner={false}
          onSignOut={() => {}}
          navItems={navItems}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
  });

  it("invokes onNavigate when a nav item is clicked", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/campaigns/1"]}>
        <CampaignSidebar
          campaign={campaign}
          campaignId="1"
          isOwner
          onSignOut={() => {}}
          navItems={navItems}
          onNavigate={onNavigate}
        />
      </MemoryRouter>
    );

    await act(async () => {
      await user.click(screen.getByRole("link", { name: /skills/i }));
    });
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("invokes onSignOut when log out is clicked", async () => {
    const onSignOut = vi.fn();
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/campaigns/1"]}>
        <CampaignSidebar
          campaign={campaign}
          campaignId="1"
          isOwner
          onSignOut={onSignOut}
          navItems={navItems}
          onNavigate={onNavigate}
        />
      </MemoryRouter>
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /log out/i }));
    });
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});




