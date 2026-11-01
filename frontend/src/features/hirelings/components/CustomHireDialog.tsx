import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { hireWarbandHireling } from "@/features/warbands/api/warbands-hirelings";
import type { WarbandResource } from "@/features/warbands/types/warband-types";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { matchCounter } from "../fees";
import FeeEditor from "./fees/FeeEditor";
import { feeDraftOf, feeFromDraft, type FeeDraft } from "./fees/fee-draft";

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/**
 * Hire someone not in the list (`hirelings/hire/` with `source: custom`): a name and type, the fee
 * paid (its gold, and each resource from the warband's resource of that name, never below 0) and
 * the upkeep he is kept for, as the catalogue's fees are (the fees step). The rest is set in his
 * Edit.
 */
export default function CustomHireDialog({
  campaignId,
  warband,
  open,
  onClose,
}: {
  campaignId: number;
  warband: { id: number; name: string; resources?: WarbandResource[] };
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [fee, setFee] = useState<FeeDraft>(() => feeDraftOf(null));
  const [upkeep, setUpkeep] = useState<FeeDraft>(() => feeDraftOf(null));
  const [saving, setSaving] = useState(false);
  const counters = warband.resources ?? [];
  const paid = feeFromDraft(fee);

  const hire = async () => {
    setSaving(true);
    try {
      const answer = await hireWarbandHireling(warband.id, {
        source: "custom",
        name: name.trim(),
        unit_type: type.trim(),
        price: paid.gold ?? 0,
        // no counter named: the server pays each from the resource of its name ("Wyrdstone shards" pays Wyrdstone)
        resources: paid.resources,
        upkeep_fee: feeFromDraft(upkeep),
      });
      toastServerWarnings(answer.warnings);
      toast.success(`${answer.name?.trim() || "He"} joins ${warband.name}.`);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.warbandSheet(campaignId, warband.id),
      });
      setName("");
      setType("");
      setFee(feeDraftOf(null));
      setUpkeep(feeDraftOf(null));
      onClose();
    } catch (error) {
      toast.error("Couldn't hire.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={(next) => (next ? null : onClose())}
      kicker={`Hire for ${warband.name}`}
      title="Hire someone not in the list"
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
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className={LABEL}>
            Name
            <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className={LABEL}>
            Type
            <Input value={type} maxLength={80} onChange={(event) => setType(event.target.value)} />
          </label>
        </div>
        <FeeEditor label="Hire fee paid" idPrefix="custom-hire" value={fee} onChange={setFee} />
        {paid.resources.map((line) => {
          const counter = matchCounter(line, counters);
          return (
            <span
              key={line.resource}
              className={
                !counter || counter.amount >= line.amount
                  ? "text-xs text-text2"
                  : "text-xs font-semibold text-danger"
              }
            >
              {counter
                ? `${line.amount} ${line.resource} from ${counter.name} (holds ${counter.amount})`
                : `${line.amount} ${line.resource} from your resource of that name, if you have one; the hire says if not.`}
            </span>
          );
        })}
        <FeeEditor label="Upkeep" idPrefix="custom-upkeep" value={upkeep} onChange={setUpkeep} />
      </div>
    </ModalSheet>
  );
}
