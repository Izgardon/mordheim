import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { Field, FormError, TEXTAREA } from "@/features/campaigns/components/settings/settings-ui";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { getPlot } from "../api/plots-api";
import { useDeletePlot, useSavePlot } from "../api/plots-queries";
import { blankDraft, draftOf, inputOf, type PlotDraft } from "./plot-draft";
import { LadderRungs, ScoringLines } from "./PlotLines";

type PlotEditorProps = {
  campaignId: number;
  /** The plot being edited, or null to add one. */
  plotId: number | null;
  canDelete: boolean;
  onClose: () => void;
};

/**
 * The campaign's own plot, written in a drawer on the web and a bottom sheet on a phone
 * (`edit_catalogue`): its name, who may follow it as prose the player decides on, its scoring and
 * its ladder. What the plot is missing comes back from the server as warnings, never a refusal.
 */
export default function PlotEditor({ campaignId, plotId, canDelete, onClose }: PlotEditorProps) {
  const loaded = useQuery({
    queryKey: queryKeys.campaign.plotEntry(campaignId, plotId ?? 0),
    queryFn: ({ signal }) => getPlot(plotId as number, signal),
    enabled: plotId !== null,
  });
  const save = useSavePlot(campaignId);
  const remove = useDeletePlot(campaignId);
  const [draft, setDraft] = useState<PlotDraft>(blankDraft);

  useEffect(() => {
    if (loaded.data) setDraft(draftOf(loaded.data));
  }, [loaded.data]);

  const change = (part: Partial<PlotDraft>) => setDraft((held) => ({ ...held, ...part }));
  const failure = save.error ?? remove.error;

  const submit = () => {
    save.mutate(
      { plotId, input: inputOf(draft) },
      {
        // what the plot is missing: a warning each (no rung at 40, nothing saying who may follow it)
        onSuccess: (plot) => {
          plot.warnings?.forEach((warning) => toast.warning(warning));
          onClose();
        },
      }
    );
  };

  return (
    <SidePanel
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      kicker="Plots"
      title={plotId === null ? "Add a plot" : draft.name || "Plot"}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canDelete && plotId !== null ? (
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate(plotId, { onSuccess: onClose })}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button disabled={save.isPending || !draft.name.trim()} onClick={submit}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Name" hint="The plot's name, as the player will read it.">
          <Input
            aria-label="Plot name"
            value={draft.name}
            maxLength={160}
            onChange={(event) => change({ name: event.target.value })}
          />
        </Field>
        <Field label="Who may follow it">
          <textarea
            aria-label="Who may follow it"
            value={draft.who_text}
            className={TEXTAREA}
            onChange={(event) => change({ who_text: event.target.value })}
          />
        </Field>
        <Field label="Scoring">
          <ScoringLines lines={draft.scoring} onChange={change} />
        </Field>
        <Field label="Ladder">
          <LadderRungs rungs={draft.achievements} onChange={change} />
        </Field>
        <FormError
          message={failure ? getErrorMessage(failure, "Couldn't save that.") : undefined}
        />
      </div>
    </SidePanel>
  );
}
