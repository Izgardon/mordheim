import { SearchCombobox, type SearchOption } from "@/components/ui/search-select";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";

import { useAddScenario, useScenarioCatalogue } from "../api/scenario-queries";
import type { CampaignScenario, Scenario } from "../types";
import ScenarioPlayersIcon from "./ScenarioPlayersIcon";

const optionOf = (scenario: Scenario): SearchOption => ({
  id: scenario.id,
  title: scenario.name,
  subtitle: [scenario.source, scenario.summary].filter(Boolean).join(" · "),
  keywords: scenario.source,
  icon: <ScenarioPlayersIcon players={scenario.players} />,
});

/** Add scenario: the whole catalogue but what the list holds, searched; a pick joins it at 1×. */
export default function AddScenarioDialog({
  campaignId,
  open,
  onOpenChange,
  listed,
  onAdded,
}: {
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listed: CampaignScenario[];
  onAdded: (row: CampaignScenario) => void;
}) {
  const catalogue = useScenarioCatalogue(campaignId, open);
  const add = useAddScenario(campaignId);
  const held = new Set(listed.map((row) => row.scenario.id));
  const options = (catalogue.data ?? []).filter((entry) => !held.has(entry.id)).map(optionOf);
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Scenarios"
      title="Add scenario"
      closeButton
      className="max-w-[560px]"
    >
      <div className="flex flex-col gap-2">
        <SearchCombobox
          inline
          autoFocus
          label="Add scenario"
          placeholder="Search scenarios"
          emptyText="No scenario matches."
          loading={catalogue.isLoading}
          options={options}
          onPick={(option) =>
            add.mutate(
              { scenarioId: Number(option.id) },
              {
                onSuccess: (row) => {
                  onOpenChange(false);
                  onAdded(row);
                },
              }
            )
          }
        />
        {add.error ? (
          <p role="alert" className="m-0 text-sm text-danger">
            {getErrorMessage(add.error, "Couldn't add the scenario.")}
          </p>
        ) : null}
      </div>
    </ModalSheet>
  );
}
