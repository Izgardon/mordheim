import type { RuleTable } from "@/features/items/types/item-types";

/** Who a scenario is for: two warbands, three or more, or either (William, 25 Nov 2026). */
export type ScenarioPlayers = "1v1" | "multiplayer" | "either";

/** One heading of a scenario and its text; its tables stand where `{{table:N}}` marks them. */
export type ScenarioSection = { title: string; text: string; tables: RuleTable[] };

/** A scenario as the catalogue answers it (`GET scenarios/`, `scenarios/:id/`). */
export type Scenario = {
  id: number;
  name: string;
  slug: string;
  number: string;
  source: string;
  players: ScenarioPlayers;
  summary: string;
  intro: string;
  sections: ScenarioSection[];
  campaign_id: number | null;
};

/** A row of the campaign's list: its weight in the random draw (0: never drawn) and its scenario. */
export type CampaignScenario = { id: number; weight: number; scenario: Scenario };

/** A campaign's own scenario as the Add new form writes it. */
export type ScenarioInput = {
  name: string;
  players: ScenarioPlayers;
  source: string;
  summary: string;
  intro: string;
  sections: { title: string; text: string }[];
};

/** The titles every scenario names the same way, in their usual order (the form's quick picks). */
export const STANDARD_SECTIONS = [
  "Terrain",
  "Warbands",
  "Set-up",
  "Starting the game",
  "Special rules",
  "Ending the game",
  "Experience",
  "Wyrdstone",
] as const;
