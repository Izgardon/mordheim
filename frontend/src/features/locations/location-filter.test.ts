import { describe, expect, it } from "vitest";

import { filterGroups, locationCount, locationSub } from "./location-filter";
import type { CampaignLocation, LocationGroup } from "./types";

const place = (id: number, name: string, rules = ""): CampaignLocation => ({
  id,
  group_id: 1,
  name,
  rules,
  min_heroes: 1,
  max_heroes: 1,
  heroes_text: "1 hero",
  takes_trading_action: false,
  order: id,
  tables: [],
  charts: [],
});
const group = (id: number, name: string, locations: CampaignLocation[]): LocationGroup => ({
  id,
  campaign_id: 1,
  name,
  description: "",
  restrictions: "",
  order: id,
  locations,
});
const GROUPS = [
  group(1, "The Undercity", [place(1, "Altar"), place(2, "Rat Market", "Buy warpstone.")]),
  group(2, "Marketplace", [place(3, "Gunsmith")]),
];

describe("filterGroups", () => {
  it("keeps every group without a search", () => {
    expect(filterGroups(GROUPS, " ")).toBe(GROUPS);
  });

  it("keeps a matching group whole and otherwise only its matching locations", () => {
    expect(filterGroups(GROUPS, "market").map((g) => [g.name, g.locations.length])).toEqual([
      ["The Undercity", 1],
      ["Marketplace", 1],
    ]);
    expect(filterGroups(GROUPS, "warpstone")[0].locations.map((l) => l.name)).toEqual([
      "Rat Market",
    ]);
    expect(filterGroups(GROUPS, "nowhere")).toEqual([]);
  });
});

describe("the row lines", () => {
  it("counts a group's locations and says what a location takes", () => {
    expect(locationCount(GROUPS[1])).toBe("1 location");
    expect(locationCount(GROUPS[0])).toBe("2 locations");
    expect(locationSub({ heroes_text: "2 heroes", takes_trading_action: true })).toBe(
      "2 heroes · Trading action"
    );
  });
});
