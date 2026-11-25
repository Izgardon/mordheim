import { useState } from "react";
import { Dices } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { getErrorMessage } from "@/lib/get-error-message";

import { useCampaignScenarios, useDrawScenario } from "../api/scenario-queries";
import type { CampaignScenario } from "../types";
import ScenarioPlayersIcon from "./ScenarioPlayersIcon";

/** The scenario a battle is played as: its name, and the campaign's scenario when one was picked. */
export type ScenarioPick = { name: string; scenarioId: number | null };

const optionOf = ({ scenario }: CampaignScenario): SearchOption => ({
  id: scenario.id,
  title: scenario.name,
  subtitle: scenario.source,
  keywords: scenario.summary,
  icon: <ScenarioPlayersIcon players={scenario.players} />,
});

/**
 * Start a battle's scenario: a picker over the campaign's list (its icon beside each) that still
 * takes a typed name, and Random scenario, the server's weighted draw from the whole list
 * (whoever plays: William, 25 Nov 2026), which fills the box; drawing again replaces it.
 */
export default function ScenarioField({
  campaignId,
  value,
  onChange,
}: {
  campaignId: number;
  value: ScenarioPick;
  onChange: (pick: ScenarioPick) => void;
}) {
  const rows = useCampaignScenarios(campaignId);
  const draw = useDrawScenario(campaignId);
  const [settled, setSettled] = useState<string | null>(null); // a typed name kept with "Play"
  const [error, setError] = useState("");
  const options = (rows.data ?? []).map(optionOf);
  const listed = options.find((option) => option.id === value.scenarioId) ?? null;
  const picked: SearchOption | null =
    listed ?? (value.name && settled === value.name ? { id: "typed", title: value.name } : null);
  const choose = (pick: ScenarioPick) => {
    setError("");
    onChange(pick);
  };

  return (
    <div className="flex flex-col gap-1">
      {/* the button first: a dialog's first focus lands on it, not on the field, whose list would
          open over the players */}
      <div className="flex items-end justify-between gap-2">
        <span className="pb-1 text-xs font-bold text-muted-foreground">Scenario</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-10"
          disabled={draw.isPending}
          onClick={() =>
            draw.mutate(undefined, {
              onSuccess: (row) => choose({ name: row.scenario.name, scenarioId: row.scenario.id }),
              onError: (failure) => setError(getErrorMessage(failure, "Couldn't draw a scenario.")),
            })
          }
        >
          <Dices aria-hidden="true" />
          Random scenario
        </Button>
      </div>
      <SearchSelect
        label="Scenario"
        placeholder="Search or type a scenario"
        emptyText="No scenario on the campaign's list matches."
        loading={rows.isLoading}
        options={options}
        value={picked}
        clearLabel="Clear the scenario"
        onTyped={(name) => {
          setSettled(null);
          choose({ name, scenarioId: null });
        }}
        onChange={(option) =>
          choose(
            option && typeof option.id === "number"
              ? { name: option.title, scenarioId: option.id }
              : { name: "", scenarioId: null }
          )
        }
        create={{
          label: (name) => `Play “${name}”`,
          onCreate: (name) => {
            setSettled(name);
            choose({ name, scenarioId: null });
          },
        }}
      />
      {error ? (
        <p role="alert" className="m-0 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
