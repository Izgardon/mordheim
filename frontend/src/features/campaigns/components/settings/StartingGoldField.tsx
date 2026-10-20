import { useEffect, useState } from "react";
import { useQueryClient, type Query } from "@tanstack/react-query";

import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import { ConfirmDialog } from "@components/confirm-dialog";
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";
import { getErrorMessage } from "@/lib/get-error-message";

import { useUpdateCampaign } from "../../hooks/useCampaignQuery";

import type { CampaignSummary } from "../../types/campaign-types";

/** A warband's sheet, summary or treasury in this campaign: what an adjustment changes. */
const isWarbandGoldQuery = (campaignId: number) => (query: Query) => {
  const [scope, id, kind, warbandId, part] = query.queryKey;
  return (
    scope === "campaign" &&
    id === campaignId &&
    kind === "warband" &&
    typeof warbandId === "number" &&
    (part === "sheet" || part === "summary" || part === "treasury")
  );
};

const signedGold = (amount: number) => `${amount > 0 ? "+" : ""}${amount} gc`;

/**
 * The campaign's starting gold (decision 6, BUG-78). A change asks each time whether existing
 * warbands get the difference, ticked before the start and unticked after; the server writes one
 * Adjustment row per warband, and their sheets and treasuries are read again.
 */
export default function StartingGoldField({ campaign }: { campaign: CampaignSummary }) {
  const queryClient = useQueryClient();
  const updateCampaign = useUpdateCampaign(campaign.id);
  const current = campaign.starting_gold ?? 500;
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [adjustExisting, setAdjustExisting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setValue(String(current)), [current]);

  const amount = Number(value);
  const difference = amount - current;

  const askToSave = () => {
    if (value.trim() === "" || Number.isNaN(amount) || amount < 0) {
      setError("Enter a valid starting gold amount.");
      return;
    }
    setError("");
    setAdjustExisting(!campaign.in_progress);
    setIsConfirmOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    try {
      await updateCampaign({ starting_gold: amount, adjust_existing_warbands: adjustExisting });
      setIsConfirmOpen(false);
      if (adjustExisting) {
        void queryClient.invalidateQueries({ predicate: isWarbandGoldQuery(campaign.id) });
      }
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to save starting gold."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-foreground">Starting gold</Label>
      <div className="flex flex-wrap justify-between items-end gap-3">
        <NumberInput
          min={0}
          placeholder="0"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={askToSave}
          disabled={isSaving || amount === current}
        >
          {isSaving ? "Saving" : "Save"}
        </Button>
      </div>
      <p className="min-h-[1.25rem] text-sm text-red-600">{isConfirmOpen ? "" : error}</p>
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Change starting gold"
        description={
          <div className="space-y-3">
            <p>{`Change the starting gold from ${current} to ${amount} gc?`}</p>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={adjustExisting}
                onChange={(event) => setAdjustExisting(event.target.checked)}
                disabled={isSaving}
              />
              <span>{`Adjust existing warbands by ${signedGold(difference)}`}</span>
            </label>
            <p className="text-xs text-muted-foreground">
              {adjustExisting
                ? `Each warband gets an Adjustment of ${signedGold(difference)} in its treasury.`
                : `Existing warbands keep their gold; only new warbands start with ${amount} gc.`}
            </p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        }
        confirmText={isSaving ? "Saving..." : "Save starting gold"}
        confirmVariant="secondary"
        isConfirming={isSaving}
        onConfirm={() => void handleSave()}
      />
    </div>
  );
}
