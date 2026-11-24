import { describe, expect, it } from "vitest";

import { encampmentCount, filterGroups, holdingLine } from "./encampment-filter";
import type { CampaignEncampment, EncampmentGroup } from "./types";

const camp = (overrides: Partial<CampaignEncampment> = {}): CampaignEncampment => ({
  id: 1,
  group_id: 1,
  name: "Tavern",
  gained_by: "Seaside Situations 53",
  fortified: false,
  text: "Roll a D6 after each battle.",
  holder: null,
  razed: false,
  order: 0,
  capabilities: { take: true, raze: false, give_up: false },
  ...overrides,
});

const city: EncampmentGroup = {
  id: 1,
  campaign_id: 1,
  name: "Marienburg city",
  description: "Inside the walls.",
  order: 0,
  encampments: [
    camp(),
    camp({
      id: 2,
      name: "Old Fort",
      gained_by: "Exploration 11111",
      holder: { id: 9, name: "Rats", player: "Rex" },
    }),
  ],
};

describe("filterGroups", () => {
  it("keeps a matching group whole", () => {
    expect(filterGroups([city], "walls")).toEqual([city]);
  });

  it("keeps the encampments that match by name, gaining, words or holder", () => {
    expect(filterGroups([city], "seaside")[0].encampments.map((c) => c.name)).toEqual(["Tavern"]);
    expect(filterGroups([city], "rats")[0].encampments.map((c) => c.name)).toEqual(["Old Fort"]);
    expect(filterGroups([city], "nowhere")).toEqual([]);
  });
});

describe("the row lines", () => {
  it("say who holds it, nobody, or razed", () => {
    expect(holdingLine(camp())).toBe("Nobody's");
    expect(holdingLine(camp({ holder: { id: 9, name: "Rats", player: "Rex" } }))).toBe(
      "Held by Rats (Rex)"
    );
    expect(holdingLine(camp({ razed: true }))).toBe("Razed");
    expect(encampmentCount(city)).toBe("2 encampments");
  });
});
