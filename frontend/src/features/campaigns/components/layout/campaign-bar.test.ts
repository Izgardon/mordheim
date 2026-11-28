import { describe, expect, it } from "vitest";

import { campaignBarContent, isOwnWarbandPage } from "./campaign-bar";

const none = {
  isOverview: false,
  readiness: true,
  postgame: false,
  battle: false,
  raise: false,
  archived: false,
};

describe("campaignBarContent", () => {
  it("shows the most urgent first off the overview: your battle, Raise your warband, archived", () => {
    expect(campaignBarContent({ ...none, battle: true, raise: true, archived: true })).toBe(
      "battle"
    );
    expect(campaignBarContent({ ...none, raise: true, archived: true })).toBe("raise");
    expect(campaignBarContent({ ...none, archived: true })).toBe("archived");
    expect(campaignBarContent(none)).toBe("none");
  });

  it("keeps Between battles first on the overview, your battle included (William)", () => {
    const overview = { ...none, isOverview: true };
    expect(campaignBarContent({ ...overview, battle: true, raise: true, archived: true })).toBe(
      "readiness"
    );
    // nobody has a warband yet: nothing in the bar but its links
    expect(campaignBarContent({ ...overview, readiness: false, battle: true })).toBe("none");
  });

  it("puts your post-game's steps in the bar on your warband page, before any battle to rejoin", () => {
    const all = { ...none, postgame: true, battle: true, raise: true, archived: true };
    expect(campaignBarContent(all)).toBe("postgame");
    expect(campaignBarContent({ ...all, isOverview: true })).toBe("readiness");
  });

  it("knows your warband page from someone else's", () => {
    expect(isOwnWarbandPage("/campaigns/2/warband")).toBe(true);
    expect(isOwnWarbandPage("/campaigns/2/warbands/7")).toBe(false);
    expect(isOwnWarbandPage("/campaigns/2/battles")).toBe(false);
  });
});
