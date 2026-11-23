import { useState, type ReactNode } from "react";

import { Chip } from "@/components/ui/chip";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { useCampaignCharts, useCampaignRules } from "@/features/rules/api/rule-queries";
import { ruleRows } from "@/features/rules/campaign-rule-rows";
import CampaignChartView from "@/features/rules/components/CampaignChartView";
import ChartTable from "@/features/rules/components/ChartTable";
import { rulesTabs } from "@/features/rules/data/rules-content";
import type { RuleTable } from "@/features/rules/types/rule-types";
import { useHouseRules } from "@/features/rules/api/rule-queries";

import BattleWarbandRules from "./BattleWarbandRules";

const HOUSE = "house";
const WARBANDS = "warbands";
const BATTLE = "battle-rules";
const CHARTS = "charts";

/** A titled block of text in a panel, as the house rules read, with the rule's own table under it. */
function RuleEntry({
  title,
  body,
  table,
}: {
  title: string;
  body: string;
  table?: RuleTable | null;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line py-2.5">
      <h3 className="m-0 font-bold text-head">{title}</h3>
      {body ? <p className="m-0 whitespace-pre-line text-sm text-text2">{body}</p> : null}
      {table ? <ChartTable rows={table.rows} dice={table.dice} /> : null}
      {table?.note ? (
        <p className="m-0 whitespace-pre-line text-xs text-muted-foreground">{table.note}</p>
      ) : null}
    </div>
  );
}

/**
 * Rules during a battle: the scenario, the campaign's house rules, its battle rules and charts
 * (William, 19 Nov 2026: "We will need to make battle rules and charts accessible in the battle
 * menu too"), the warbands' own rules, and the rulebook, one section at a time. A section with
 * nothing in it shows no chip.
 */
export default function BattleRulesSheet({
  open,
  onOpenChange,
  campaignId,
  scenario,
  scenarioLink,
  warbands = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  scenario: string;
  scenarioLink: string | null;
  /** The battle's warbands, whose own rules the Warband rules section shows. */
  warbands?: { id: number; name: string }[];
}) {
  const houseRules = useHouseRules(campaignId).data ?? [];
  const battleRules = ruleRows(useCampaignRules(campaignId).data ?? [], "battle");
  const charts = useCampaignCharts(campaignId).data ?? [];
  const [tabId, setTabId] = useState<string>(HOUSE);

  const own: { id: string; label: string; panel: ReactNode }[] = [
    houseRules.length
      ? {
          id: HOUSE,
          label: "House rules",
          panel: (
            <div className="flex flex-col">
              {houseRules.map((rule) => (
                <RuleEntry key={rule.id} title={rule.title} body={rule.description} />
              ))}
            </div>
          ),
        }
      : null,
    battleRules.length
      ? {
          id: BATTLE,
          label: "Battle rules",
          panel: (
            <div className="flex flex-col">
              {battleRules.flatMap((row) =>
                row.rules.map((rule) => (
                  <RuleEntry
                    key={rule.id}
                    title={row.umbrella ? `${row.umbrella}: ${rule.title}` : rule.title}
                    body={rule.body}
                    table={rule.chart}
                  />
                ))
              )}
            </div>
          ),
        }
      : null,
    charts.length
      ? {
          id: CHARTS,
          label: "Tables",
          panel: (
            <div className="flex flex-col gap-5">
              {charts.map((chart) => (
                <CampaignChartView key={chart.id} chart={chart} heading />
              ))}
            </div>
          ),
        }
      : null,
    warbands.length
      ? {
          id: WARBANDS,
          label: "Warband rules",
          panel: <BattleWarbandRules campaignId={campaignId} warbands={warbands} />,
        }
      : null,
  ].flatMap((entry) => entry ?? []);

  const mine = own.find((entry) => entry.id === tabId) ?? null;
  const book = mine ? null : (rulesTabs.find((entry) => entry.id === tabId) ?? rulesTabs[0]);

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Quick reference"
      title="Rules"
      className="max-w-[720px]"
    >
      <p className="m-0 text-sm text-text2">
        Scenario: <span className="font-bold text-ink">{scenario}</span>
        {scenarioLink ? (
          <>
            {" · "}
            <a
              href={scenarioLink}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent-text underline underline-offset-2"
            >
              read it
            </a>
          </>
        ) : null}
      </p>
      <div role="group" aria-label="Rules section" className="flex flex-wrap gap-1.5">
        {own.map((entry) => (
          <Chip key={entry.id} pressed={mine?.id === entry.id} onClick={() => setTabId(entry.id)}>
            {entry.label}
          </Chip>
        ))}
        {rulesTabs.map((entry) => (
          <Chip
            key={entry.id}
            pressed={book !== null && entry.id === book.id}
            onClick={() => setTabId(entry.id)}
          >
            {entry.label}
          </Chip>
        ))}
      </div>
      {mine ? (
        mine.panel
      ) : (
        // Static, bundled rules text (features/rules/data), not user content.
        <div className="rules-content" dangerouslySetInnerHTML={{ __html: book!.content }} />
      )}
    </ModalSheet>
  );
}
