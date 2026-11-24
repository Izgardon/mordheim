import type {
  CampaignEncampment,
  EncampmentGroup,
  EncampmentsPage,
} from "@/features/encampments/types";
import type { CampaignRule } from "@/features/rules/types/rule-types";

const NONE = { take: true, raze: false, give_up: false };

export const makeEncampment = (
  overrides: Partial<CampaignEncampment> = {}
): CampaignEncampment => ({
  id: 4,
  group_id: 2,
  name: "Tavern",
  gained_by: "Seaside Situations 53",
  fortified: false,
  text: "After each battle roll a D6.",
  holder: null,
  razed: false,
  order: 0,
  capabilities: NONE,
  ...overrides,
});

export const makeEncampmentGroup = (overrides: Partial<EncampmentGroup> = {}): EncampmentGroup => ({
  id: 2,
  campaign_id: 1,
  name: "Marienburg city",
  description: "Inside the walls.",
  order: 0,
  encampments: [
    makeEncampment(),
    makeEncampment({
      id: 5,
      name: "Old Fort",
      gained_by: "Exploration 11111",
      fortified: true,
      holder: { id: 9, name: "Rats", player: "Rex" },
    }),
  ],
  ...overrides,
});

export const holdingRule: CampaignRule = {
  id: 40,
  campaign_id: 1,
  kind: "encampment",
  title: "Holding an encampment",
  body: "An encampment is held until it is razed.",
  umbrella: "",
  order: 0,
  chart: null,
};

export const makeEncampmentsPage = (overrides: Partial<EncampmentsPage> = {}): EncampmentsPage => ({
  rules: [holdingRule],
  groups: [makeEncampmentGroup()],
  takers: [{ id: 3, name: "Monks", mine: true }],
  ...overrides,
});
