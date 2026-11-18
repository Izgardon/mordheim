import { useEffect, useState } from "react";
import { useQueryClient, type Query } from "@tanstack/react-query";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import type { CampaignSummary } from "../../types/campaign-types";
import { useCampaignSave } from "./CampaignSection";
import { SettingRow } from "./settings-ui";

/** A warband's sheet, summary or treasury in this campaign: what a gold adjustment changes. */
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
const NUMBER_FIELD = "w-[110px] font-mono";

/**
 * The starting gold (decision 6, BUG-78). A change asks whether existing warbands get the
 * difference, ticked before the campaign starts and unticked after; the server writes one
 * Adjustment per warband, and their sheets and treasuries are read again.
 */
export default function StartingGold({ campaign }: { campaign: CampaignSummary }) {
  const queryClient = useQueryClient();
  const current = campaign.starting_gold ?? 500;
  const [value, setValue] = useState(String(current));
  const [confirming, setConfirming] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const { saving, error, setError, save } = useCampaignSave(
    campaign.id,
    "Couldn't save the starting gold."
  );
  useEffect(() => setValue(String(current)), [current]);
  const amount = Number(value);
  const difference = amount - current;

  const ask = () => {
    if (value.trim() === "" || !Number.isInteger(amount) || amount < 0) {
      setError("Enter the starting gold in whole crowns.");
      return;
    }
    setError("");
    setAdjust(!campaign.in_progress);
    setConfirming(true);
  };
  const submit = async () => {
    if (await save({ starting_gold: amount, adjust_existing_warbands: adjust })) {
      setConfirming(false);
      if (adjust)
        void queryClient.invalidateQueries({ predicate: isWarbandGoldQuery(campaign.id) });
    }
  };

  return (
    <SettingRow label="Starting gold" error={confirming ? "" : error}>
      <NumberInput
        min={0}
        aria-label="Starting gold"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={NUMBER_FIELD}
      />
      <span className="text-sm text-text2">gc</span>
      <Button variant="secondary" disabled={saving || amount === current} onClick={ask}>
        Save
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Change the starting gold"
        description={
          <div className="flex flex-col gap-3">
            <p className="m-0 text-ink">{`Change the starting gold from ${current} to ${amount} gc?`}</p>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <Checkbox
                checked={adjust}
                disabled={saving}
                onChange={(event) => setAdjust(event.target.checked)}
              />
              {`Adjust the warbands already raised by ${signedGold(difference)}`}
            </label>
            <p className="m-0 text-xs">
              {adjust
                ? `Each warband gets an Adjustment of ${signedGold(difference)} in its treasury.`
                : `The warbands already raised keep their gold; only new ones start with ${amount} gc.`}
            </p>
          </div>
        }
        error={error}
        confirmText={saving ? "Saving…" : "Save the starting gold"}
        confirmVariant="primary"
        isConfirming={saving}
        onConfirm={() => void submit()}
      />
    </SettingRow>
  );
}
