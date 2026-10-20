import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_CAPABILITIES,
  campaignCapabilities,
  canRemoveMember,
  hasCampaignSettings,
  isArchived,
  readCapabilities,
} from "./capabilities";

import type { CampaignRole } from "./types/campaign-types";

const viewer = (role: CampaignRole, capabilities: Record<string, boolean> = {}) => ({
  role,
  capabilities,
});

describe("readCapabilities", () => {
  it("reads only true as true, and every missing or unknown key as false (fails closed)", () => {
    const flags = readCapabilities(["edit", "trade", "delete"] as const, {
      edit: true,
      trade: "yes",
      extra: true,
    });

    expect(flags).toEqual({ edit: true, trade: false, delete: false });
  });

  it("gives every flag false without a payload", () => {
    expect(readCapabilities(["edit"] as const, undefined)).toEqual({ edit: false });
    expect(readCapabilities(["edit"] as const, null)).toEqual({ edit: false });
  });
});

describe("campaignCapabilities", () => {
  it("has every campaign flag, true only where the payload says so", () => {
    const flags = campaignCapabilities({ capabilities: { start: true, manage_battles: true } });

    expect(Object.keys(flags)).toEqual([...CAMPAIGN_CAPABILITIES]);
    expect(flags.start).toBe(true);
    expect(flags.manage_battles).toBe(true);
    expect(flags.edit_settings).toBe(false);
  });

  it("is all false for no campaign, or a campaign read without its flags", () => {
    expect(Object.values(campaignCapabilities(null)).some(Boolean)).toBe(false);
    expect(Object.values(campaignCapabilities({})).some(Boolean)).toBe(false);
  });
});

describe("canRemoveMember", () => {
  const owner = viewer("owner", { remove_members: true });
  const admin = viewer("admin", { remove_members: true });

  it("lets the owner remove admins and players, never the owner", () => {
    expect(canRemoveMember(owner, { role: "admin" })).toBe(true);
    expect(canRemoveMember(owner, { role: "player" })).toBe(true);
    expect(canRemoveMember(owner, { role: "owner" })).toBe(false);
  });

  it("lets an admin remove players only", () => {
    expect(canRemoveMember(admin, { role: "player" })).toBe(true);
    expect(canRemoveMember(admin, { role: "admin" })).toBe(false);
    expect(canRemoveMember(admin, { role: "owner" })).toBe(false);
  });

  it("lets nobody remove anyone without remove_members", () => {
    expect(canRemoveMember(viewer("player"), { role: "player" })).toBe(false);
    expect(canRemoveMember(viewer("owner"), { role: "player" })).toBe(false);
  });
});

describe("hasCampaignSettings", () => {
  it("opens the Campaign tab for any flag one of its cards needs", () => {
    const none = campaignCapabilities(null);

    expect(hasCampaignSettings(none)).toBe(false);
    expect(hasCampaignSettings({ ...none, view_members: true })).toBe(true);
    expect(hasCampaignSettings({ ...none, manage_battles: true })).toBe(true);
    expect(hasCampaignSettings({ ...none, edit_settings: true })).toBe(true);
    expect(hasCampaignSettings({ ...none, delete: true })).toBe(true);
    expect(hasCampaignSettings({ ...none, archive: true })).toBe(true);
    expect(hasCampaignSettings({ ...none, restore: true })).toBe(true);
    expect(hasCampaignSettings({ ...none, add_custom: true, manage_items: true })).toBe(false);
  });
});

describe("isArchived", () => {
  it("reads the campaign's archived_at", () => {
    expect(isArchived({ archived_at: "2026-10-20T10:00:00Z" })).toBe(true);
    expect(isArchived({ archived_at: null })).toBe(false);
    expect(isArchived({})).toBe(false);
    expect(isArchived(null)).toBe(false);
  });
});
