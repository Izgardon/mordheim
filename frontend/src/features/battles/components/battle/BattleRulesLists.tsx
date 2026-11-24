import { useMemo } from "react";

import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import {
  useCampaignCharts,
  useCampaignRules,
  useHouseRules,
} from "@/features/rules/api/rule-queries";
import { chartRowSub, chartRows, ruleRowSub, ruleRows } from "@/features/rules/campaign-rule-rows";
import { ChartRowBody, RuleRowBody } from "@/features/rules/components/CampaignRowBodies";
import HouseRuleRow from "@/features/rules/components/HouseRuleRow";
import RuleBookRow from "@/features/rules/components/RuleBookRow";
import { ruleEntries } from "@/features/rules/rules-index";

/** Which row is open in a list, and its toggle: one open at a time, as on the pages. */
export type OpenRow = { openKey: string | null; onToggle: (key: string) => void };

type ListProps = OpenRow & { campaignId: number };

/** Battle rules, a row per umbrella or lone rule, as the Campaign rules page groups them. */
export function BattleRuleRows({ campaignId, openKey, onToggle }: ListProps) {
  const query = useCampaignRules(campaignId);
  const rows = ruleRows(query.data ?? [], "battle");
  return (
    <ReferenceList isEmpty={!query.isPending && rows.length === 0} empty="No battle rules yet.">
      {query.isPending ? <ReferenceRowBones /> : null}
      {rows.map((row) => (
        <ReferenceRow
          key={row.key}
          id={row.key}
          open={openKey === row.key}
          onToggle={() => onToggle(row.key)}
          name={row.name}
          sub={ruleRowSub(row) || undefined}
        >
          <RuleRowBody row={row} />
        </ReferenceRow>
      ))}
    </ReferenceList>
  );
}

/** The campaign's charts, a row per umbrella or lone chart, as the Campaign rules page has them. */
export function ChartRows({ campaignId, openKey, onToggle }: ListProps) {
  const query = useCampaignCharts(campaignId);
  const rows = chartRows(query.data ?? []);
  return (
    <ReferenceList isEmpty={!query.isPending && rows.length === 0} empty="No charts yet.">
      {query.isPending ? <ReferenceRowBones /> : null}
      {rows.map((row) => (
        <ReferenceRow
          key={row.key}
          id={row.key}
          open={openKey === row.key}
          onToggle={() => onToggle(row.key)}
          name={row.name}
          sub={chartRowSub(row)}
        >
          <ChartRowBody row={row} />
        </ReferenceRow>
      ))}
    </ReferenceList>
  );
}

/** The campaign's house rules, as the House rules page lists them. */
export function HouseRuleRows({ campaignId, openKey, onToggle }: ListProps) {
  const query = useHouseRules(campaignId);
  const rules = query.data ?? [];
  return (
    <ReferenceList isEmpty={!query.isPending && rules.length === 0} empty="No house rules yet.">
      {query.isPending ? <ReferenceRowBones /> : null}
      {rules.map((rule) => {
        const key = `h${rule.id}`;
        return (
          <HouseRuleRow
            key={key}
            rule={rule}
            open={openKey === key}
            onToggle={() => onToggle(key)}
            onClose={() => onToggle(key)}
            isMobile
          />
        );
      })}
    </ReferenceList>
  );
}

/** The rulebook, a row per headed part with its section under it, as the Rules page lists them. */
export function RuleBookRows({ openKey, onToggle }: OpenRow) {
  const entries = useMemo(() => ruleEntries(), []);
  return (
    <ReferenceList isEmpty={false}>
      {entries.map((entry) => (
        <RuleBookRow
          key={entry.id}
          entry={entry}
          open={openKey === entry.id}
          onToggle={() => onToggle(entry.id)}
          isMobile
        />
      ))}
    </ReferenceList>
  );
}
