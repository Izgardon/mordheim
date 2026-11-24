import { describe, expect, it } from "vitest";

import { scenarioRows, sourceLine } from "./scenario-rows";
import type { CampaignScenario } from "./types";

const row = (
  id: number,
  name: string,
  weight: number,
  source = "Mordheim Rulebook"
): CampaignScenario => ({
  id,
  weight,
  scenario: {
    id,
    name,
    slug: name.toLowerCase(),
    number: id < 3 ? String(id) : "",
    source,
    players: "1v1",
    summary: `${name} summary`,
    intro: "",
    sections: [{ title: "Terrain", text: "", tables: [] }],
    campaign_id: null,
  },
});

const ROWS = [row(1, "Skirmish", 6), row(2, "Occupy", 5), row(3, "The Pool", 3, "Town Cryer #5")];

describe("scenarioRows", () => {
  it("lists by name, heaviest first or by source", () => {
    expect(scenarioRows([...ROWS], "", "name").map((r) => r.scenario.name)).toEqual([
      "Occupy",
      "Skirmish",
      "The Pool",
    ]);
    expect(scenarioRows([...ROWS], "", "weight").map((r) => r.weight)).toEqual([6, 5, 3]);
    expect(scenarioRows([...ROWS], "", "source").map((r) => r.scenario.name)).toEqual([
      "Occupy",
      "Skirmish",
      "The Pool",
    ]);
  });

  it("searches the name, the source and the summary", () => {
    expect(scenarioRows([...ROWS], "cryer", "name").map((r) => r.scenario.name)).toEqual([
      "The Pool",
    ]);
    expect(scenarioRows([...ROWS], "occupy summ", "name")).toHaveLength(1);
  });

  it("names the source with its number there", () => {
    expect(sourceLine(ROWS[0])).toBe("Mordheim Rulebook · 1");
    expect(sourceLine(ROWS[2])).toBe("Town Cryer #5");
  });
});
