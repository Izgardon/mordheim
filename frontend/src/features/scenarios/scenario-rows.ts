import type { CampaignScenario, Scenario } from "./types";

export type ScenarioSort = "name" | "weight" | "source";

export const SORT_OPTIONS: { id: ScenarioSort; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "weight", label: "Weight" },
  { id: "source", label: "Source" },
];

const fold = (text: string) => text.trim().toLowerCase();

/** Whether a row's scenario matches what was typed: its name, source, summary or a heading. */
export function matchesScenario({ scenario }: CampaignScenario, query: string) {
  const typed = fold(query);
  if (!typed) return true;
  return [
    scenario.name,
    scenario.source,
    scenario.summary,
    ...scenario.sections.map((s) => s.title),
  ]
    .map(fold)
    .some((text) => text.includes(typed));
}

const byName = (a: CampaignScenario, b: CampaignScenario) =>
  a.scenario.name.localeCompare(b.scenario.name);

/**
 * The list's rows as the page shows them: those matching the search, by name, or heaviest first,
 * or by source (then name).
 */
export function scenarioRows(rows: CampaignScenario[], query: string, sort: ScenarioSort) {
  const shown = rows.filter((row) => matchesScenario(row, query));
  if (sort === "weight") return shown.sort((a, b) => b.weight - a.weight || byName(a, b));
  if (sort === "source")
    return shown.sort((a, b) => a.scenario.source.localeCompare(b.scenario.source) || byName(a, b));
  return shown.sort(byName);
}

/** The line under a scenario's name: its source, and its number there ("Mordheim Rulebook · 3"). */
export const sourceLine = ({ scenario }: { scenario: Pick<Scenario, "source" | "number"> }) =>
  [scenario.source, scenario.number].filter(Boolean).join(" · ");
