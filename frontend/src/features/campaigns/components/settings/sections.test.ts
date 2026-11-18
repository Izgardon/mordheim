/**
 * The settings sections, since Archive stopped being one of them (William, 18 Nov 2026: "The
 * archive section can just be at the bottom of the campaign settings page for the owner only"):
 * the menu no longer lists it, the links that pointed at it land on Campaign, and the owner of an
 * archived campaign still has Campaign to restore or delete it from.
 */
import { describe, expect, it } from "vitest";

import { campaignCapabilities } from "../../capabilities";
import { campaignFor, campaignSummary } from "@/test/campaign-fixtures";

import { sectionFromUrl, settingsSections } from "./sections";

const labels = (campaign = campaignSummary()) =>
  settingsSections(campaignCapabilities(campaign), campaign).map((section) => section.label);

const landsOn = (section: string, campaign = campaignSummary()) =>
  sectionFromUrl(
    new URLSearchParams(`section=${section}`),
    settingsSections(campaignCapabilities(campaign), campaign)
  );

describe("the settings menu", () => {
  it("lists no Archive row for the owner, who archives from the foot of Campaign", () => {
    expect(labels()).toEqual(["Campaign", "Players", "Battles", "Your warband", "Feedback"]);
  });

  it("keeps Campaign for the owner of an archived campaign, who may still restore it", () => {
    const archived = campaignSummary({ archived_at: "2026-11-01T18:00:00Z" });

    expect(campaignCapabilities(archived).edit_settings).toBe(false);
    expect(campaignCapabilities(archived).restore).toBe(true);
    expect(labels(archived)).toContain("Campaign");
  });

  it("gives a player neither Campaign nor an archive of any kind", () => {
    expect(labels(campaignFor("player"))).toEqual(["Your warband", "Feedback"]);
  });
});

describe("the links that pointed at a section", () => {
  it("sends ?section=archive to Campaign, which holds the archive card now", () => {
    expect(landsOn("archive")).toBe("campaign");
  });

  it("still sends the old ?section=active-battles to Battles, and anything unknown nowhere", () => {
    expect(landsOn("active-battles")).toBe("battles");
    expect(landsOn("nonsense")).toBeNull();
  });

  it("sends ?section=archive nowhere for a player, who has no Campaign section", () => {
    expect(landsOn("archive", campaignFor("player"))).toBeNull();
  });
});
