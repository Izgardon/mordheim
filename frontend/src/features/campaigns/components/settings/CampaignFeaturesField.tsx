import { useEffect, useState } from "react";

import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import { Label } from "@components/label";
import { getErrorMessage } from "@/lib/get-error-message";

import { useUpdateCampaign } from "../../hooks/useCampaignQuery";

import type { CampaignSummary } from "../../types/campaign-types";

type FeatureToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function FeatureToggle({ label, description, checked, onChange }: FeatureToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/35 px-3 py-2">
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Checkbox
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
    </div>
  );
}

/** The Encampments and Locations pages, switched on or off for everyone (owner only). */
export default function CampaignFeaturesField({ campaign }: { campaign: CampaignSummary }) {
  const updateCampaign = useUpdateCampaign(campaign.id);
  const [enableEncampments, setEnableEncampments] = useState(Boolean(campaign.enable_encampments));
  const [enableLocations, setEnableLocations] = useState(Boolean(campaign.enable_locations));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Any change to the card's settings resets its drafts, as when the card held them all.
  useEffect(() => {
    setEnableEncampments(Boolean(campaign.enable_encampments));
    setEnableLocations(Boolean(campaign.enable_locations));
  }, [campaign.enable_encampments, campaign.enable_locations, campaign.item_settings]);

  const hasChanged =
    enableEncampments !== Boolean(campaign.enable_encampments) ||
    enableLocations !== Boolean(campaign.enable_locations);

  const handleSave = async () => {
    setError("");
    setIsSaving(true);
    try {
      await updateCampaign({
        enable_encampments: enableEncampments,
        enable_locations: enableLocations,
      });
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to save campaign features."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold text-foreground">Campaign features</Label>
          <p className="text-sm text-muted-foreground">
            Enable or disable the shared campaign sections that appear for everyone in this
            campaign.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleSave}
          disabled={isSaving || !hasChanged}
        >
          {isSaving ? "Saving" : "Save"}
        </Button>
      </div>

      <div className="space-y-3">
        <FeatureToggle
          label="Enable encampments"
          description="Show the Encampments page and allow encampment ownership."
          checked={enableEncampments}
          onChange={setEnableEncampments}
        />
        <FeatureToggle
          label="Enable locations"
          description="Show the Locations page."
          checked={enableLocations}
          onChange={setEnableLocations}
        />
      </div>
      <p className="min-h-[1.25rem] text-sm text-red-600">{error}</p>
    </div>
  );
}
