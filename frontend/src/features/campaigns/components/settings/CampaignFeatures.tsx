import { Switch } from "@/components/ui/switch";

import { usePresetLocks } from "../../api/preset-queries";
import { useCampaignSave } from "../../hooks/settings/useCampaignSave";
import type { CampaignSummary } from "../../types/campaign-types";
import PresetNote, { presetDim } from "./PresetNote";
import SettingsDisclosure, { departuresFor } from "./SettingsDisclosure";
import { FEATURES, featuresSummary } from "./settings-summaries";
import { FormError } from "./settings-ui";

/**
 * The Encampments page, Locations, Plots (campaign points: William's label of 16 Nov 2026) and
 * Blood pacts, switched on or off for everyone; each saves as it flips. One the campaign's preset
 * sets is greyed and still operable, and warns once the owner has departed from it.
 */
export default function CampaignFeatures({ campaign }: { campaign: CampaignSummary }) {
  const { saving, error, save } = useCampaignSave(campaign.id, "Couldn't save that.");
  const locks = usePresetLocks(campaign.id);
  return (
    <SettingsDisclosure
      title="Features"
      summary={featuresSummary(campaign)}
      warnings={departuresFor(
        locks.departures,
        FEATURES.map((feature) => feature.key)
      )}
    >
      {FEATURES.map((feature) => {
        const on = Boolean(campaign[feature.key]);
        return (
          <div
            key={feature.key}
            className="flex items-center justify-between gap-4 border-t border-line pt-4 first:border-t-0 first:pt-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-bold text-head">{feature.label}</span>
              <PresetNote locks={locks} field={feature.key} />
            </div>
            <Switch
              checked={on}
              aria-label={feature.label}
              disabled={saving}
              className={presetDim(locks, feature.key)}
              onCheckedChange={(next) => void save({ [feature.key]: next })}
            >
              {on ? "On" : "Off"}
            </Switch>
          </div>
        );
      })}
      <FormError message={error} />
    </SettingsDisclosure>
  );
}
