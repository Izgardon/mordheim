import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CampaignPageSkeleton from "./CampaignPageSkeleton";

describe("CampaignPageSkeleton", () => {
  it.each([
    ["/campaigns/3", "Loading the overview"],
    ["/campaigns/3/battles", "Loading the battles"],
    ["/campaigns/3/battles/8/postbattle", "Loading the aftermath"],
    ["/campaigns/3/battles/8/active", "Loading the battle"],
    ["/campaigns/3/battles/8/prebattle", "Loading the battle"],
    ["/campaigns/3/warband", "Loading the warband"],
    ["/campaigns/3/warbands/12", "Loading the warband"],
    ["/campaigns/3/settings", "Loading the settings"],
    ["/campaigns/3/skills", "Loading the reference"],
    ["/campaigns/3/house-rules", "Loading the reference"],
  ])("shows the skeleton of the page at %s", (pathname, label) => {
    render(<CampaignPageSkeleton pathname={pathname} />);

    expect(screen.getByRole("status", { name: label })).toHaveAttribute("aria-busy", "true");
  });
});
