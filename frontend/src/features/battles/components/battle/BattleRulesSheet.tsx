import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { ModalSheet } from "@/components/ui/modal-sheet";

import {
  BattleRuleRows,
  ChartRows,
  HouseRuleRows,
  RuleBookRows,
  type OpenRow,
} from "./BattleRulesLists";
import BattleWarbandRules from "./BattleWarbandRules";
import ScenarioSheet, { type BattleScenario } from "./ScenarioSheet";

/** The sheet's five pills, in William's order (24 Nov 2026). */
export const BATTLE_RULES_SECTIONS = [
  { id: "battle", label: "Battle rules" },
  { id: "warbands", label: "Warband rules" },
  { id: "charts", label: "Charts" },
  { id: "house", label: "House rules" },
  { id: "rules", label: "Rules" },
] as const;

type SectionId = (typeof BATTLE_RULES_SECTIONS)[number]["id"];

/**
 * Rules during a battle (William, 24 Nov 2026: "i only want 5 pills in this order: Battle rules,
 * Warband rules, Charts, House rules, Rules. It should be a scrolling bar"): the scenario as a
 * button opening its details, then one row of pills, the one picked showing its list as rows that
 * open in place, grouped as its own page groups them (umbrellas, warbands, the rulebook's parts).
 * The scenario's details take the sheet's place while open, so nothing stacks on a phone.
 */
export default function BattleRulesSheet({
  open,
  onOpenChange,
  campaignId,
  scenario,
  warbands = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  /** Null before the battle is read (the pre-battle bar): no scenario button. */
  scenario: BattleScenario | null;
  /** The battle's warbands, whose own rules the Warband rules section shows. */
  warbands?: { id: number; name: string }[];
}) {
  const [section, setSection] = useState<SectionId>("battle");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  useEffect(() => {
    if (!open) setDetails(false);
  }, [open]);
  const rows: OpenRow = {
    openKey,
    onToggle: (key) => setOpenKey(openKey === key ? null : key),
  };
  const pick = (next: SectionId) => {
    setSection(next);
    setOpenKey(null);
  };

  return (
    <>
      <ModalSheet
        open={open && !details}
        onOpenChange={onOpenChange}
        kicker="Quick reference"
        title="Rules"
        className="max-w-[720px]"
      >
        {scenario ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setDetails(true)}
            className="flex min-h-11 items-center justify-between gap-2.5 border border-border bg-surface px-3 text-left text-sm text-text2 hover:bg-raised"
          >
            <span className="min-w-0">
              Scenario: <span className="font-bold text-ink">{scenario.name}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        ) : null}
        <div
          role="group"
          aria-label="Rules section"
          className="scroll-row -mx-4 flex shrink-0 gap-1.5 px-4 min-[961px]:mx-0 min-[961px]:px-0"
        >
          {BATTLE_RULES_SECTIONS.map((entry) => (
            <Chip
              key={entry.id}
              className="shrink-0"
              pressed={section === entry.id}
              onClick={() => pick(entry.id)}
            >
              {entry.label}
            </Chip>
          ))}
        </div>
        {/* a phone keeps the sheet one height whichever pill is picked (William, 25 Nov 2026: "it jumps
            around a lot") */}
        <div data-testid="rules-section" className="flex flex-col gap-4 max-[960px]:min-h-[55dvh]">
          {section === "battle" ? <BattleRuleRows campaignId={campaignId} {...rows} /> : null}
          {section === "warbands" ? (
            <BattleWarbandRules campaignId={campaignId} warbands={warbands} {...rows} />
          ) : null}
          {section === "charts" ? <ChartRows campaignId={campaignId} {...rows} /> : null}
          {section === "house" ? <HouseRuleRows campaignId={campaignId} {...rows} /> : null}
          {section === "rules" ? <RuleBookRows {...rows} /> : null}
        </div>
      </ModalSheet>
      {scenario ? (
        <ScenarioSheet
          campaignId={campaignId}
          scenario={scenario}
          open={open && details}
          onOpenChange={(next) => setDetails(next)}
        />
      ) : null}
    </>
  );
}
