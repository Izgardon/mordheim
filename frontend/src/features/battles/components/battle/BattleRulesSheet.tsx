import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { useHouseRules } from "@/features/rules/api/rule-queries";
import { rulesTabs } from "@/features/rules/data/rules-content";

import BattleWarbandRules from "./BattleWarbandRules";

const HOUSE = "house";
const WARBANDS = "warbands";

/**
 * Rules during a battle: the scenario, the campaign's house rules (its rules endpoint), the
 * warbands' own rules as their pills (the templates plan), and the rulebook, one section at a time.
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
  const [tabId, setTabId] = useState<string>(HOUSE);
  const showHouse = tabId === HOUSE && houseRules.length > 0;
  const showWarbands = tabId === WARBANDS && warbands.length > 0;
  const tab = rulesTabs.find((entry) => entry.id === tabId) ?? rulesTabs[0];
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
        {houseRules.length ? (
          <Chip pressed={showHouse} onClick={() => setTabId(HOUSE)}>
            House rules
          </Chip>
        ) : null}
        {warbands.length ? (
          <Chip pressed={showWarbands} onClick={() => setTabId(WARBANDS)}>
            Warband rules
          </Chip>
        ) : null}
        {rulesTabs.map((entry) => (
          <Chip
            key={entry.id}
            pressed={!showHouse && !showWarbands && entry.id === tab.id}
            onClick={() => setTabId(entry.id)}
          >
            {entry.label}
          </Chip>
        ))}
      </div>
      {showWarbands ? (
        <BattleWarbandRules campaignId={campaignId} warbands={warbands} />
      ) : showHouse ? (
        <dl className="m-0 flex flex-col">
          {houseRules.map((rule) => (
            <div key={rule.id} className="flex flex-col gap-1 border-t border-line py-2.5">
              <dt className="font-bold text-head">{rule.title}</dt>
              <dd className="m-0 whitespace-pre-line text-sm text-text2">{rule.description}</dd>
            </div>
          ))}
        </dl>
      ) : (
        // Static, bundled rules text (features/rules/data), not user content.
        <div className="rules-content" dangerouslySetInnerHTML={{ __html: tab.content }} />
      )}
    </ModalSheet>
  );
}
