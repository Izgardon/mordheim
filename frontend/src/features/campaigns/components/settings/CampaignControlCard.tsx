import { useEffect, useMemo, useState } from "react";

import { X } from "lucide-react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { Checkbox } from "@components/checkbox";
import { Label } from "@components/label";
import RestrictionPicker from "@/features/warbands/components/shared/RestrictionPicker";
import { listRestrictions } from "@/features/items/api/items-api";

import { updateCampaign } from "../../api/campaigns-api";

import type { Restriction } from "@/features/items/types/item-types";
import type { CampaignSummary } from "../../types/campaign-types";

type CampaignControlCardProps = {
  campaign: CampaignSummary;
  onCampaignUpdated?: (campaign: CampaignSummary) => void;
};

export default function CampaignControlCard({ campaign, onCampaignUpdated }: CampaignControlCardProps) {
  const [enableEncampments, setEnableEncampments] = useState(Boolean(campaign.enable_encampments));
  const [enableLocations, setEnableLocations] = useState(Boolean(campaign.enable_locations));
  const [availableSettings, setAvailableSettings] = useState<Restriction[]>([]);
  const [selectedSettings, setSelectedSettings] = useState<Restriction[]>(campaign.item_settings ?? []);
  const [isEditingItemSettings, setIsEditingItemSettings] = useState(false);
  const [campaignFeaturesError, setCampaignFeaturesError] = useState("");
  const [itemSettingsError, setItemSettingsError] = useState("");
  const [isSavingCampaignFeatures, setIsSavingCampaignFeatures] = useState(false);
  const [isSavingItemSettings, setIsSavingItemSettings] = useState(false);

  useEffect(() => {
    setEnableEncampments(Boolean(campaign.enable_encampments));
    setEnableLocations(Boolean(campaign.enable_locations));
    setSelectedSettings(campaign.item_settings ?? []);
  }, [campaign.enable_encampments, campaign.enable_locations, campaign.item_settings]);

  useEffect(() => {
    listRestrictions({ type: "Setting" })
      .then(setAvailableSettings)
      .catch(() => setAvailableSettings([]));
  }, []);

  const selectedSettingIds = useMemo(
    () => new Set(selectedSettings.map((restriction) => restriction.id)),
    [selectedSettings]
  );

  const hasCampaignFeaturesChanged =
    enableEncampments !== Boolean(campaign.enable_encampments) ||
    enableLocations !== Boolean(campaign.enable_locations);

  const hasItemSettingsChanged = useMemo(() => {
    const currentIds = (campaign.item_settings ?? []).map((restriction) => restriction.id).sort((a, b) => a - b);
    const nextIds = selectedSettings.map((restriction) => restriction.id).sort((a, b) => a - b);

    if (currentIds.length !== nextIds.length) {
      return true;
    }

    return currentIds.some((id, index) => id !== nextIds[index]);
  }, [campaign.item_settings, selectedSettings]);

  const handleToggleSetting = (restriction: Restriction) => {
    setSelectedSettings((prev) =>
      prev.some((entry) => entry.id === restriction.id)
        ? prev.filter((entry) => entry.id !== restriction.id)
        : [...prev, restriction]
    );
  };

  const handleRemoveSetting = (restrictionId: number) => {
    setSelectedSettings((prev) => prev.filter((entry) => entry.id !== restrictionId));
  };

  const handleCancelItemSettings = () => {
    setIsEditingItemSettings(false);
    setSelectedSettings(campaign.item_settings ?? []);
    setItemSettingsError("");
  };

  const handleSaveCampaignFeatures = async () => {
    setCampaignFeaturesError("");
    setIsSavingCampaignFeatures(true);

    try {
      const updated = await updateCampaign(campaign.id, {
        enable_encampments: enableEncampments,
        enable_locations: enableLocations,
      });
      onCampaignUpdated?.(updated);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setCampaignFeaturesError(errorResponse.message || "Unable to save campaign features.");
      } else {
        setCampaignFeaturesError("Unable to save campaign features.");
      }
    } finally {
      setIsSavingCampaignFeatures(false);
    }
  };

  const handleSaveItemSettings = async () => {
    setItemSettingsError("");
    setIsSavingItemSettings(true);

    try {
      const updated = await updateCampaign(campaign.id, {
        item_setting_ids: selectedSettings.map((restriction) => restriction.id),
      });
      onCampaignUpdated?.(updated);
      setIsEditingItemSettings(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setItemSettingsError(errorResponse.message || "Unable to save item settings.");
      } else {
        setItemSettingsError("Unable to save item settings.");
      }
    } finally {
      setIsSavingItemSettings(false);
    }
  };

  return (
    <CardBackground className="space-y-2 p-3 bg-[rgba(12,9,6,0.92)] sm:space-y-2.5 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Campaign</h3>
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-semibold text-foreground">Campaign features</Label>
            <p className="text-sm text-muted-foreground">
              Enable or disable campaign-level systems for everyone in this campaign.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveCampaignFeatures}
            disabled={isSavingCampaignFeatures || !hasCampaignFeaturesChanged}
          >
            {isSavingCampaignFeatures ? "Saving" : "Save"}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/35 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Enable encampments</p>
              <p className="text-xs text-muted-foreground">Allow encampment ownership.</p>
            </div>
            <Checkbox
              checked={enableEncampments}
              onChange={(event) => setEnableEncampments(event.target.checked)}
              aria-label="Enable encampments"
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/35 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Enable locations</p>
              <p className="text-xs text-muted-foreground">Allow trading in the Marketplace, Infamous Haunts and Cursed Marshes.</p>
            </div>
            <Checkbox
              checked={enableLocations}
              onChange={(event) => setEnableLocations(event.target.checked)}
              aria-label="Enable locations"
            />
          </div>
        </div>
        <p className="min-h-[1.25rem] text-sm text-red-600">{campaignFeaturesError}</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-semibold text-foreground">Item settings</Label>
            <p className="text-sm text-muted-foreground">
              Campaign-wide setting restrictions applied to every warband for item availability.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEditingItemSettings ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancelItemSettings}
                  disabled={isSavingItemSettings}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSaveItemSettings}
                  disabled={isSavingItemSettings || !hasItemSettingsChanged}
                >
                  {isSavingItemSettings ? "Saving" : "Save"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setIsEditingItemSettings(true)}>
                Edit
              </Button>
            )}
          </div>
        </div>
        {selectedSettings.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedSettings.map((restriction) => (
              <div
                key={restriction.id}
                className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/20 px-2.5 py-0.5 text-sm"
              >
                <span>{restriction.restriction}</span>
                {isEditingItemSettings ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveSetting(restriction.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No item settings selected.</p>
        )}
        {isEditingItemSettings ? (
          <div className="rounded-lg border border-border/40 bg-background/40 p-3">
            <RestrictionPicker
              restrictions={availableSettings}
              selected={selectedSettingIds}
              onToggle={handleToggleSetting}
              showFilter={false}
            />
          </div>
        ) : null}
        <p className="min-h-[1.25rem] text-sm text-red-600">{itemSettingsError}</p>
      </div>
    </CardBackground>
  );
}
