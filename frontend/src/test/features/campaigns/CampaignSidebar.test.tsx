// routing
import { MemoryRouter } from "react-router-dom";

// types
import type { CampaignSummary } from "../../../features/campaigns/types/campaign-types";

// other
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CampaignSidebar from "../../../features/campaigns/components/layout/CampaignSidebar";

const campaign: CampaignSummary = {
  id: 1,
  name: "Shards of the Comet",
  campaign_type: "standard",
  join_code: "ABC123",
  max_players: 6,
  player_count: 1,
  role: "owner",
  in_progress: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const navItems = [
  { label: "Chronicle", path: "" },
  { label: "Skills", path: "skills" },
];

describe("CampaignSidebar", () => {
  it("shows settings gear when the user is an owner", () => {
    render(
      <MemoryRouter initialEntries={["/campaigns/1"]}>
        <CampaignSidebar
          campaign={campaign}
          campaignId="1"
          canManageSettings
          navItems={navItems}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("hides settings for players", () => {
    render(
      <MemoryRouter initialEntries={["/campaigns/1"]}>
        <CampaignSidebar
          campaign={campaign}
          campaignId="1"
          canManageSettings={false}
          navItems={navItems}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
  });
});



