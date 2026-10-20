import { describe, expect, it } from "vitest";

import { campaignSectionTitle } from "./campaign-nav";

describe("campaignSectionTitle", () => {
  it("names each campaign section as the phone's top bar shows it", () => {
    expect(campaignSectionTitle("/campaigns/1/items")).toBe("Wargear");
    expect(campaignSectionTitle("/campaigns/1/hired-swords")).toBe("Hired Swords");
    expect(campaignSectionTitle("/campaigns/1/house-rules")).toBe("House Rules");
    expect(campaignSectionTitle("/campaigns/1/settings")).toBe("Settings");
  });

  it("names a battle page by its section, whatever the phase", () => {
    expect(campaignSectionTitle("/campaigns/1/battles/40/active")).toBe("Battle");
  });

  it("calls the campaign's own page, and anything unknown, the Overview", () => {
    expect(campaignSectionTitle("/campaigns/1")).toBe("Overview");
    expect(campaignSectionTitle("/campaigns/1/")).toBe("Overview");
    expect(campaignSectionTitle("/campaigns/1/somewhere-new")).toBe("Overview");
  });
});
