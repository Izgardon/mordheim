import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { hireWarbandHireling } from "@/features/warbands/api/warbands-hirelings";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { formatHirelingCost, type HirelingCatalogueConfig } from "../hireling-catalogue-kinds";
import type { HirelingProfile } from "../types/hireling-catalogue-types";

type HireDialogProps = {
  config: HirelingCatalogueConfig;
  campaignId: number;
  warband: { id: number; name: string };
  /** The entry being hired; null when closed. */
  entry: HirelingProfile | null;
  onClose: () => void;
};

/**
 * Hire from the reference (today's hire, `hirelings/hire/`): the server copies the entry onto your
 * warband (profile, kit, both costs, a dramatis persona's terms), charges a gold fee and logs it.
 * A name is optional; the warband's sheet reloads with him on it.
 */
export default function HireDialog({
  config,
  campaignId,
  warband,
  entry,
  onClose,
}: HireDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const hire = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const answer = await hireWarbandHireling(warband.id, {
        source: config.source,
        id: entry.id,
        ...(name.trim() ? { name: name.trim() } : {}),
      });
      toastServerWarnings(answer.warnings);
      toast.success(`${answer.name?.trim() || entry.name} joins ${warband.name}.`);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.warbandSheet(campaignId, warband.id),
      });
      setName("");
      onClose();
    } catch (error) {
      toast.error("Couldn't hire.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={entry !== null}
      onOpenChange={(open) => (open ? null : onClose())}
      kicker={`Hire for ${warband.name}`}
      title={entry?.name ?? config.labels.singular}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-h-12" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="min-h-12" onClick={() => void hire()} disabled={saving}>
            {saving ? "Hiring…" : "Hire"}
          </Button>
        </div>
      }
    >
      {entry ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-text2">
            Hire fee {formatHirelingCost(entry.hire_cost, entry.hire_cost_expression)}, upkeep{" "}
            {formatHirelingCost(entry.upkeep_cost, entry.upkeep_cost_expression)}. A fee in gold
            comes out of the warband&apos;s gold.
          </p>
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
            Name (optional)
            <Input
              value={name}
              maxLength={120}
              placeholder={entry.name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </ModalSheet>
  );
}
