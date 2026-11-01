import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { useUpdateCampaign } from "../../hooks/useCampaignQuery";
import type { CampaignSummary, CampaignUpdatePayload } from "../../types/campaign-types";
import CampaignRules from "./CampaignRules";
import ContentInPlayCard from "./ContentInPlayCard";
import { SettingRow, SettingsCard } from "./settings-ui";

/** One PATCH with its pending flag and error, for a setting saved on its own. */
export function useCampaignSave(campaignId: number, fallback: string) {
  const update = useUpdateCampaign(campaignId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (payload: CampaignUpdatePayload) => {
    setSaving(true);
    setError("");
    try {
      await update(payload);
      return true;
    } catch (failure) {
      setError(getErrorMessage(failure, fallback));
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, setError, save };
}

/** The campaign's name: the owner renames it (the campaigns list shows the new one too). */
function CampaignName({ campaign }: { campaign: CampaignSummary }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(campaign.name);
  const { saving, error, setError, save } = useCampaignSave(campaign.id, "Couldn't rename it.");
  useEffect(() => setName(campaign.name), [campaign.name]);
  const trimmed = name.trim();

  const rename = async () => {
    if (!trimmed) {
      setError("Give the campaign a name.");
      return;
    }
    if (await save({ name: trimmed })) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns() });
    }
  };

  return (
    <SettingRow label="Name" error={error}>
      <Input
        aria-label="Campaign name"
        value={name}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        className="w-[280px] max-[960px]:min-w-0 max-[960px]:flex-1"
      />
      <Button
        variant="secondary"
        disabled={saving || !trimmed || trimmed === campaign.name}
        onClick={() => void rename()}
      >
        {saving ? "Saving…" : "Rename"}
      </Button>
    </SettingRow>
  );
}

/** The Encampments page and Locations, switched on or off for everyone; each saves as it flips. */
function CampaignFeatures({ campaign }: { campaign: CampaignSummary }) {
  const { saving, error, save } = useCampaignSave(campaign.id, "Couldn't save that.");
  const features = [
    {
      key: "enable_encampments" as const,
      label: "Encampments",
      on: Boolean(campaign.enable_encampments),
    },
    {
      key: "enable_locations" as const,
      label: "Locations",
      on: Boolean(campaign.enable_locations),
    },
  ];
  return (
    <>
      {features.map((feature) => (
        <SettingRow key={feature.key} label={feature.label}>
          <Switch
            checked={feature.on}
            aria-label={feature.label}
            disabled={saving}
            onCheckedChange={(next) => void save({ [feature.key]: next })}
          >
            {feature.on ? "On" : "Off"}
          </Switch>
        </SettingRow>
      ))}
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </>
  );
}

/**
 * Settings → Campaign (`edit_settings`, the owner): its name and the pages switched on, the content
 * in play (grade presets and settings), then the warband rules (starting gold, limits, the death
 * roll and the level-ups).
 */
export default function CampaignSection({ campaign }: { campaign: CampaignSummary }) {
  return (
    <>
      <SettingsCard title="Campaign">
        <CampaignName campaign={campaign} />
        <CampaignFeatures campaign={campaign} />
      </SettingsCard>
      <ContentInPlayCard campaign={campaign} />
      <CampaignRules campaign={campaign} />
    </>
  );
}
