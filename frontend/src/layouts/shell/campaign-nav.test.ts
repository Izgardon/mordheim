import { describe, expect, it } from "vitest";

import { campaignSectionTitle, isBattlePath, mobileNavActiveId } from "./campaign-nav";

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

describe("the campaign's Account page", () => {
  it("is titled Account and belongs to Me, as Settings does", () => {
    expect(campaignSectionTitle("/campaigns/1/account")).toBe("Account");
    expect(mobileNavActiveId("/campaigns/1/account")).toBe("me");
    expect(mobileNavActiveId("/campaigns/1/settings")).toBe("me");
  });
});
