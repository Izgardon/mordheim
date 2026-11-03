import { describe, expect, it } from "vitest";

import { battleStageTitle, campaignBarContent } from "./campaign-bar";

const none = { isOverview: false, readiness: true, battle: false, raise: false, archived: false };

describe("campaignBarContent", () => {
  it("shows the most urgent first off the overview: your battle, Raise your warband, archived", () => {
    expect(campaignBarContent({ ...none, battle: true, raise: true, archived: true })).toBe(
      "battle"
    );
    expect(campaignBarContent({ ...none, raise: true, archived: true })).toBe("raise");
    expect(campaignBarContent({ ...none, archived: true })).toBe("archived");
    expect(campaignBarContent(none)).toBe("title");
  });

  it("keeps Between battles first on the overview, your battle included (William)", () => {
    const overview = { ...none, isOverview: true };
    expect(campaignBarContent({ ...overview, battle: true, raise: true, archived: true })).toBe(
      "readiness"
    );
    // nobody has a warband yet: the campaign's name and the page's title
    expect(campaignBarContent({ ...overview, readiness: false, battle: true })).toBe("title");
  });
});

describe("battleStageTitle", () => {
  it("titles a battle's screens by their stage", () => {
    expect(battleStageTitle("prebattle")).toBe("Before the battle");
    expect(battleStageTitle("active")).toBe("Battle");
    expect(battleStageTitle("postbattle")).toBe("Aftermath");
    expect(battleStageTitle(undefined)).toBe("Battle");
  });
});
