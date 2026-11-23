import type { CampaignChart, CampaignRule, CampaignRuleKind } from "./types/rule-types";

/** The prefix a kind's row keys carry, so one `?open=` can name a row on any of the three lists. */
const PREFIX: Record<CampaignRuleKind, string> = { campaign: "r", battle: "b" };

const keyOf = (prefix: string, id: number, umbrella: string) =>
  umbrella.trim() ? `${prefix}u:${umbrella.trim().toLowerCase()}` : `${prefix}${id}`;

/** The key of the row a rule sits in: its umbrella's, or its own. */
export const ruleRowKey = (rule: Pick<CampaignRule, "id" | "kind" | "umbrella">) =>
  keyOf(PREFIX[rule.kind], rule.id, rule.umbrella);

export const chartRowKey = (chart: Pick<CampaignChart, "id" | "umbrella">) =>
  keyOf("c", chart.id, chart.umbrella);

/**
 * A row on the Campaign rules page: one entry, or the umbrella several share (William, 19 Nov
 * 2026: "I want to start grouping clearly related rules together into umbrellas", "one modal for
 * all shared rules"). A row's `key` is what the URL opens it by.
 */
export type RuleRow = {
  key: string;
  /** The row's heading: the umbrella's name, or the lone rule's title. */
  name: string;
  /** The umbrella's name, or "" for a rule that stands alone. */
  umbrella: string;
  rules: CampaignRule[];
};

export type ChartRow = {
  key: string;
  name: string;
  umbrella: string;
  charts: CampaignChart[];
};

type Grouped = { key: string; name: string; umbrella: string; members: unknown[] };

/**
 * Group entries in their order: those naming the same umbrella become one row where the first of
 * them sits, and an entry with no umbrella is a row of its own. An umbrella's row is keyed by its
 * name so it survives a rule being added to or taken out of the group; a lone entry's by its id.
 * `prefix` keeps the three lists' keys apart, because one `?open=` opens a row on any of them.
 */
function group<T extends { id: number; umbrella: string }>(
  entries: T[],
  prefix: string
): Grouped[] {
  const rows: (Grouped & { members: T[] })[] = [];
  const byUmbrella = new Map<string, Grouped & { members: T[] }>();
  for (const entry of entries) {
    const umbrella = entry.umbrella.trim();
    if (!umbrella) {
      rows.push({ key: `${prefix}${entry.id}`, name: "", umbrella: "", members: [entry] }); // its own
      continue;
    }
    const held = byUmbrella.get(umbrella.toLowerCase());
    if (held) {
      held.members.push(entry);
      continue;
    }
    const row = {
      key: `${prefix}u:${umbrella.toLowerCase()}`,
      name: umbrella,
      umbrella,
      members: [entry],
    };
    byUmbrella.set(umbrella.toLowerCase(), row);
    rows.push(row);
  }
  return rows;
}

/** The rules of one kind as rows, in their order. */
export function ruleRows(rules: CampaignRule[], kind: CampaignRuleKind): RuleRow[] {
  const mine = rules.filter((rule) => rule.kind === kind);
  return group(mine, PREFIX[kind]).map((row) => {
    const members = row.members as CampaignRule[];
    return { ...row, name: row.name || members[0].title, rules: members };
  });
}

export function chartRows(charts: CampaignChart[]): ChartRow[] {
  return group(charts, "c").map((row) => {
    const members = row.members as CampaignChart[];
    return { ...row, name: row.name || members[0].title, charts: members };
  });
}

/** What a row is found by: its heading and every entry's own words. */
export function ruleRowWords(row: RuleRow): string[] {
  return [
    row.name,
    ...row.rules.flatMap((rule) => [
      rule.title,
      rule.body,
      ...(rule.chart
        ? [
            rule.chart.description,
            rule.chart.note,
            ...rule.chart.rows.map((entry) => `${entry.result} ${entry.name} ${entry.text}`),
          ]
        : []),
    ]),
  ];
}

export function chartRowWords(row: ChartRow): string[] {
  return [
    row.name,
    ...row.charts.flatMap((chart) => [
      chart.title,
      chart.description,
      chart.note,
      ...chart.rows.flatMap((entry) => [entry.result, entry.name, entry.text]),
    ]),
  ];
}

/** "3 rules", "D66 · 32 results": the line under a row's heading. */
export function ruleRowSub(row: RuleRow): string {
  if (!row.umbrella) return "";
  return `${row.rules.length} ${row.rules.length === 1 ? "rule" : "rules"}`;
}

export function chartRowSub(row: ChartRow): string {
  if (row.umbrella) {
    return `${row.charts.length} ${row.charts.length === 1 ? "table" : "tables"}`;
  }
  const chart = row.charts[0];
  const results = `${chart.rows.length} ${chart.rows.length === 1 ? "result" : "results"}`;
  return chart.dice ? `${chart.dice} · ${results}` : results;
}
