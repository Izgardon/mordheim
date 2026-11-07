import { describe, expect, it } from "vitest";

import {
  REFERENCE_LINKS,
  REFERENCE_SECTIONS,
  RULES_LINKS,
  campaignSectionTitle,
  isBattlePath,
  mobileNavActiveId,
  warbandLinks,
} from "./campaign-nav";

describe("isBattlePath", () => {
  it("is a battle's own screens, not the Battles page (which keeps the campaign's nav)", () => {
    expect(isBattlePath("/campaigns/1/battles")).toBe(false);
    expect(isBattlePath("/campaigns/1/battles/")).toBe(false);
    expect(isBattlePath("/campaigns/1/battles/7")).toBe(true);
    expect(isBattlePath("/campaigns/1/battles/7/prebattle")).toBe(true);
    expect(isBattlePath("/campaigns/1/battles/7/active")).toBe(true);
    expect(isBattlePath("/campaigns/1/warband")).toBe(false);
  });

  it("titles the Battles page Battles and a battle Battle", () => {
    expect(campaignSectionTitle("/campaigns/1/battles")).toBe("Battles");
    expect(campaignSectionTitle("/campaigns/1/battles/7/prebattle")).toBe("Battle");
  });
});

describe("References and Rules", () => {
  it("are two sections that share the phone's Reference button", () => {
    expect(REFERENCE_SECTIONS.map((section) => section.title)).toEqual(["References", "Rules"]);
    expect(RULES_LINKS.map((link) => link.path)).toEqual([
      "rules",
      "house-rules",
      "campaign-rules",
    ]);
    expect(REFERENCE_LINKS.map((link) => link.path)).not.toContain("rules");
    for (const path of ["rules", "house-rules", "campaign-rules", "items", "bestiary", "search"]) {
      expect(mobileNavActiveId(`/campaigns/1/${path}`)).toBe("reference");
    }
    expect(campaignSectionTitle("/campaigns/1/house-rules")).toBe("House rules");
    expect(campaignSectionTitle("/campaigns/1/campaign-rules")).toBe("Campaign rules");
    expect(campaignSectionTitle("/campaigns/1/items")).toBe("Wargear");
  });
});

describe("the campaign's Account page", () => {
  it("is titled Account and belongs to Me, as Settings does", () => {
    expect(campaignSectionTitle("/campaigns/1/account")).toBe("Account");
    expect(mobileNavActiveId("/campaigns/1/account")).toBe("me");
    expect(mobileNavActiveId("/campaigns/1/settings")).toBe("me");
  });
});

describe("My warband's links", () => {
  it("open the Locations page from Locations (William, 7 Nov 2026: 'clicking locations in nav takes you there')", () => {
    const links = warbandLinks({ enable_encampments: true, enable_locations: true });
    expect(links.map((link) => [link.label, link.path])).toEqual([
      ["Warband", "warband"],
      ["Encampment", "encampments"],
      ["Locations", "locations"],
    ]);
    expect(mobileNavActiveId("/campaigns/1/locations")).toBe("warband");
    expect(warbandLinks({ enable_encampments: false, enable_locations: false })).toHaveLength(1);
  });
});
