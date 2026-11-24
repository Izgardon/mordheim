import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { setupUser } from "@/test/user-event";

import NavRail from "./NavRail";

const BASE = `/campaigns/${CAMPAIGN_ID}`;

/** Where the rail's links and its search field take the app. */
function Where({ seen }: { seen: { pathname: string; search: string } }) {
  const location = useLocation();
  seen.pathname = location.pathname;
  seen.search = location.search;
  return null;
}

const renderRail = (path: string) => {
  const seen = { pathname: path, search: "" };
  render(
    <MemoryRouter initialEntries={[path]}>
      <NavRail campaign={campaignSummary()} userName="Raider" tools={null} />
      <Where seen={seen} />
    </MemoryRouter>
  );
  return { location: () => ({ ...seen }) };
};

const links = (group: HTMLElement) =>
  within(group)
    .getAllByRole("link")
    .map((link) => link.textContent);

describe("the rail's References and Rules", () => {
  it("are two sections, the search field heading References and the rulebook with the house rules and the campaign rules under Rules", () => {
    renderRail(`${BASE}/house-rules`);

    const references = screen.getByRole("group", { name: "References" });
    const rules = screen.getByRole("group", { name: "Rules" });

    expect(within(references).getByRole("heading", { name: "References" })).toBeInTheDocument();
    expect(links(references)).toEqual([
      "Wargear",
      "Skills",
      "Spells",
      "Boons & Banes",
      "Bestiary",
      "Hired swords",
      "Dramatis personae",
      "Warbands",
    ]);
    expect(within(rules).getByRole("heading", { name: "Rules" })).toBeInTheDocument();
    expect(links(rules)).toEqual(["Rules", "House rules", "Campaign rules"]);
    expect(within(rules).getByRole("link", { name: "Rules" })).toHaveAttribute(
      "href",
      `${BASE}/rules`
    );
    expect(within(rules).getByRole("link", { name: "House rules" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("searches everything from a field at the head of References, the words it was given applied", async () => {
    const user = setupUser();
    const app = renderRail(`${BASE}/house-rules`);

    const field = within(screen.getByRole("group", { name: "References" })).getByRole("search");
    await user.type(within(field).getByRole("searchbox", { name: "Search everything" }), "halberd");
    await user.click(within(field).getByRole("button", { name: "Search" }));

    expect(app.location()).toEqual({ pathname: `${BASE}/search`, search: "?q=halberd" });
  });
});

describe("the rail's Campaign section", () => {
  it("leads to the overview, the battles and the campaign's scenarios (William, 24 Nov 2026)", () => {
    renderRail(`${BASE}/scenarios`);

    const campaign = screen.getByRole("group", { name: "Campaign" });
    expect(links(campaign)).toEqual(["Overview", "Battles", "Scenarios"]);
    expect(within(campaign).getByRole("link", { name: "Scenarios" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
