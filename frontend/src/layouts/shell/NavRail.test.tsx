import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";

import NavRail from "./NavRail";

const BASE = `/campaigns/${CAMPAIGN_ID}`;

const renderRail = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <NavRail campaign={campaignSummary()} userName="Raider" tools={null} />
    </MemoryRouter>
  );

const links = (group: HTMLElement) =>
  within(group)
    .getAllByRole("link")
    .map((link) => link.textContent);

describe("the rail's References and Rules", () => {
  it("are two sections, Search everything heading References and the rulebook with the house rules under Rules", () => {
    renderRail(`${BASE}/house-rules`);

    const references = screen.getByRole("group", { name: "References" });
    const rules = screen.getByRole("group", { name: "Rules" });

    expect(within(references).getByRole("heading", { name: "References" })).toBeInTheDocument();
    expect(links(references)).toEqual([
      "Search everything",
      "Warbands",
      "Wargear",
      "Skills",
      "Spells",
      "Boons & Banes",
      "Bestiary",
      "Hired swords",
      "Dramatis personae",
    ]);
    expect(within(rules).getByRole("heading", { name: "Rules" })).toBeInTheDocument();
    expect(links(rules)).toEqual(["Rules", "House rules"]);
    expect(within(rules).getByRole("link", { name: "Rules" })).toHaveAttribute(
      "href",
      `${BASE}/rules`
    );
    expect(within(rules).getByRole("link", { name: "House rules" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
