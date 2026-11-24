import type { CampaignScenario, Scenario } from "@/features/scenarios/types";

/** A scenario as the server answers it. */
export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 1,
    name: "Wyrdstone Hunt",
    slug: "wyrdstone-hunt",
    number: "3",
    source: "Mordheim Rulebook",
    players: "1v1",
    summary: "Gain wealth by picking up wyrdstone.",
    intro: "Scattered in the ruins of Mordheim are shards of wyrdstone.",
    sections: [
      { title: "Terrain", text: "Each player places a ruin.", tables: [] },
      {
        title: "Special rules",
        text: "Place D3+1 counters.\n\n{{table:1}}",
        tables: [{ columns: ["D6", "Found"], rows: [["1-3", "One shard"]] }],
      },
    ],
    campaign_id: null,
    ...overrides,
  };
}

/** A row of the campaign's list. */
export const makeRow = (
  id: number,
  weight: number,
  scenario: Partial<Scenario> = {}
): CampaignScenario => ({
  id,
  weight,
  scenario: makeScenario({ id, ...scenario }),
});

export const HUNT = makeRow(11, 4);
export const POOL = makeRow(12, 3, {
  name: "The Pool",
  slug: "pool-tc5",
  number: "5",
  source: "Town Cryer #5",
  players: "multiplayer",
  summary: "Root around in a pool.",
  sections: [{ title: "Terrain", text: "A pool in the middle.", tables: [] }],
});
