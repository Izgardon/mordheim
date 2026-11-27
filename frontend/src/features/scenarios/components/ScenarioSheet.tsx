import { ModalSheet } from "@/components/ui/modal-sheet";
import { ErrorState } from "@/components/ui/error-state";
import { Bone, SkeletonPage, boneWidth } from "@/components/ui/skeleton";
import { useScenario } from "../api/scenario-queries";
import ScenarioDetail from "./ScenarioDetail";
import ScenarioPlayersIcon from "./ScenarioPlayersIcon";
import { sourceLine } from "../scenario-rows";
import { getErrorMessage } from "@/lib/get-error-message";

/** The battle's scenario as the Rules sheet opens it: its name, and the campaign scenario it is played as. */
export type BattleScenario = { name: string; id: number | null };

function ScenarioBones() {
  return (
    <SkeletonPage label="Loading the scenario" className="flex flex-col gap-3">
      <Bone className="h-3 w-40" />
      {Array.from({ length: 4 }, (_, index) => (
        <Bone key={index} className="h-3" style={{ width: boneWidth(index) }} />
      ))}
    </SkeletonPage>
  );
}

/** The scenario read whole (`GET scenarios/:id/`) while the sheet is open. */
function ScenarioBody({ campaignId, scenarioId }: { campaignId: number; scenarioId: number }) {
  const query = useScenario(campaignId, scenarioId);
  if (query.isPending) return <ScenarioBones />;
  if (query.isError) {
    return (
      <ErrorState
        message={getErrorMessage(query.error, "Couldn't load the scenario.")}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const scenario = query.data;
  const source = sourceLine({ scenario });
  return (
    <>
      <p className="m-0 flex items-center gap-1.5 text-sm text-text2">
        <ScenarioPlayersIcon players={scenario.players} />
        {source}
      </p>
      {scenario.summary ? (
        <p className="m-0 text-sm font-semibold text-ink">{scenario.summary}</p>
      ) : null}
      <ScenarioDetail scenario={scenario} />
    </>
  );
}

/**
 * The scenario's details (William, 24 Nov 2026: "we will be making the scenario: skirmish a button
 * to open the scenario details"): the campaign scenario the battle is played as, read as the
 * Scenarios page shows it. A battle whose scenario was typed holds only its name.
 */
export default function ScenarioSheet({
  campaignId,
  scenario,
  open,
  onOpenChange,
}: {
  campaignId: number;
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
      className="max-w-[640px]"
      closeButton
    >
      {open && scenario.id ? (
        <ScenarioBody campaignId={campaignId} scenarioId={scenario.id} />
      ) : null}
    </ModalSheet>
  );
}
