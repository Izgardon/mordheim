import { ExternalLink } from "lucide-react";

import { ModalSheet } from "@/components/ui/modal-sheet";

/** The battle's scenario as the Rules sheet opens it: its name, and its link when it has one. */
export type BattleScenario = { name: string; link: string | null };

/**
 * The scenario's details (William, 24 Nov 2026: "we will be making the scenario: skirmish a button
 * to open the scenario details"). Scenarios are not in the catalogue yet, so this holds what the
 * battle stores: the name and the link. The scenario's sections go under the link once they are.
 */
export default function ScenarioSheet({
  scenario,
  open,
  onOpenChange,
}: {
  scenario: BattleScenario;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Scenario"
      title={scenario.name}
      className="max-w-[560px]"
      closeButton
    >
      {scenario.link ? (
        <a
          href={scenario.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-accent-text underline underline-offset-2"
        >
          Read the scenario
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      ) : null}
    </ModalSheet>
  );
}
