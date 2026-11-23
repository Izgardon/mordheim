import type { CampaignLocation, LocationGroup } from "@/features/locations/types";
import type { CampaignChart } from "@/features/rules/types/rule-types";

export const hazards: CampaignChart = {
  id: 30,
  campaign_id: 1,
  title: "Forest Hazards",
  description: "",
  dice: "D6",
  note: "",
  umbrella: "",
  order: 0,
  rows: [{ id: 1, result: "1", name: "Bog", text: "Stuck for a turn." }],
};

export const makeLocation = (overrides: Partial<CampaignLocation> = {}): CampaignLocation => ({
  id: 4,
  group_id: 2,
  name: "Altar of the Horned Rat",
  rules: "Pay 10 gc and roll a D6.",
  min_heroes: 1,
  max_heroes: 1,
  heroes_text: "1 hero",
  takes_trading_action: true,
  order: 0,
  tables: [
    {
      ...hazards,
      id: 31,
      title: "Altar of the Horned Rat",
      rows: [{ id: 2, result: "1-2", name: "Unworthy!", text: "-1 Toughness next battle." }],
    },
  ],
  charts: [{ id: hazards.id, title: hazards.title }],
  ...overrides,
});

export const makeGroup = (overrides: Partial<LocationGroup> = {}): LocationGroup => ({
  id: 2,
  campaign_id: 1,
  name: "The Undercity",
  description: "Tunnels under the Pit.",
  restrictions: "Skaven warbands only.",
  order: 0,
  locations: [makeLocation()],
  ...overrides,
});
