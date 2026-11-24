import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReferenceDetail } from "@/features/reference/ReferenceDetail";
import { ReferenceRow } from "@/features/reference/ReferenceList";
import { getErrorMessage } from "@/lib/get-error-message";

import { useRemoveScenario } from "../api/scenario-queries";
import { sourceLine } from "../scenario-rows";
import type { CampaignScenario } from "../types";
import ScenarioDetail from "./ScenarioDetail";
import ScenarioPlayersIcon, { playersLabel } from "./ScenarioPlayersIcon";
import WeightField from "./WeightField";

/**
 * One of the campaign's scenarios: its icon and name, its source, its weight edited in place (a
 * manager's), opening to its summary, opening lines and sections; a manager's Remove asks first.
 */
export default function ScenarioRow({
  campaignId,
  row,
  open,
  onToggle,
  canManage,
  isMobile,
}: {
  campaignId: number;
  row: CampaignScenario;
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
  isMobile: boolean;
}) {
  const { scenario } = row;
  const remove = useRemoveScenario(campaignId);
  const [asking, setAsking] = useState(false);
  const source = sourceLine(row);
  return (
    <ReferenceRow
      id={String(row.id)}
      open={open}
      onToggle={onToggle}
      name={
        <span className="flex items-center gap-1.5">
          <ScenarioPlayersIcon players={scenario.players} />
          {scenario.name}
        </span>
      }
      sub={isMobile ? source : scenario.summary || undefined}
      cells={isMobile ? undefined : [source]}
      trailing={
        <WeightField
          campaignId={campaignId}
          rowId={row.id}
          weight={row.weight}
          name={scenario.name}
          canEdit={canManage}
        />
      }
    >
      <ReferenceDetail
        title={scenario.name}
        kind={[playersLabel(scenario.players), source].filter(Boolean).join(" · ")}
        isMobile={isMobile}
        aside={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="min-h-10" onClick={() => setAsking(true)}>
                Remove
              </Button>
            </div>
          ) : undefined
        }
      >
        {isMobile && scenario.summary ? (
          <p className="m-0 text-sm font-semibold text-ink">{scenario.summary}</p>
        ) : null}
        <ScenarioDetail scenario={scenario} />
      </ReferenceDetail>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={`Remove ${scenario.name}?`}
        description="It leaves the campaign's list and its weight is lost; battles played as it keep it."
        confirmText="Remove"
        isConfirming={remove.isPending}
        error={remove.error ? getErrorMessage(remove.error, "Couldn't remove the scenario.") : ""}
        onConfirm={() => remove.mutate(row.id, { onSuccess: () => setAsking(false) })}
      />
    </ReferenceRow>
  );
}
