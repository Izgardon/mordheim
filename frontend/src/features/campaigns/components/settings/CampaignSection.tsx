import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { usePresetLocks } from "../../api/preset-queries";
import { campaignCapabilities } from "../../capabilities";
import { useUpdateCampaign } from "../../hooks/useCampaignQuery";
import type { CampaignSummary, CampaignUpdatePayload } from "../../types/campaign-types";
import ArchiveSection from "./ArchiveSection";
import CampaignPresetCard from "./CampaignPresetCard";
import CampaignRules from "./CampaignRules";
import PresetNote, { presetDim } from "./PresetNote";
import ContentInPlayCard from "./ContentInPlayCard";
import ExplorationSection from "./ExplorationSection";
import PlotsSection from "./PlotsSection";
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

/**
 * The Encampments page, Locations, Plots (campaign points: William's label of 16 Nov 2026) and
 * Blood pacts, switched on or off for everyone; each saves as it flips. One the campaign's preset
 * sets is greyed and still operable, and warns once the owner has departed from it.
 */
function CampaignFeatures({ campaign }: { campaign: CampaignSummary }) {
  const { saving, error, save } = useCampaignSave(campaign.id, "Couldn't save that.");
  const locks = usePresetLocks(campaign.id);
  const features = [
    {
      key: "enable_encampments" as const,
      label: "Encampments",
      on: Boolean(campaign.enable_encampments),
    },
    {
      key: "enable_locations" as const,
      label: "Trade locations",
      on: Boolean(campaign.enable_locations),
    },
    {
      key: "enable_campaign_points" as const,
      label: "Plots and CP",
      on: Boolean(campaign.enable_campaign_points),
    },
    {
      key: "enable_blood_pacts" as const,
      label: "Blood pacts",
      on: Boolean(campaign.enable_blood_pacts),
    },
  ];
  return (
    <>
      {features.map((feature) => (
        <SettingRow
          key={feature.key}
          label={feature.label}
          hint={<PresetNote locks={locks} field={feature.key} />}
        >
          <Switch
            checked={feature.on}
            aria-label={feature.label}
            disabled={saving}
            className={presetDim(locks, feature.key)}
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
 * Settings → Campaign (`edit_settings`, the owner): the published campaign it plays, which sets
 * the rules, then its name, the pages and Plots switched on, the content in play (grade presets
 * and settings), the warband rules (starting gold, the default resource, limits, the death roll
 * and the level-ups), the plots it plays with while Plots is on, then the exploration chart, and
 * last of all archiving it (William, 18 Nov 2026: "The archive section can just be at the bottom
 * of the campaign settings page for the owner only"), which is a section of its own no longer. An
 * archived campaign keeps nothing but that card: every setting above it would be refused.
 */
export default function CampaignSection({ campaign }: { campaign: CampaignSummary }) {
  const capabilities = campaignCapabilities(campaign);
  return (
    <>
      {capabilities.edit_settings ? (
        <>
          <CampaignPresetCard campaign={campaign} />
          <SettingsCard title="Campaign">
            <CampaignName campaign={campaign} />
            <CampaignFeatures campaign={campaign} />
          </SettingsCard>
          <ContentInPlayCard campaign={campaign} />
          <CampaignRules campaign={campaign} />
          {campaign.enable_campaign_points ? <PlotsSection campaign={campaign} /> : null}
          <ExplorationSection campaign={campaign} />
        </>
      ) : null}
      {capabilities.archive || capabilities.restore || capabilities.delete ? (
        <ArchiveSection campaign={campaign} capabilities={capabilities} />
      ) : null}
    </>
  );
}
