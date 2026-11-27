import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { useSettingsList } from "../../api/settings-queries";
import { useCampaignSave } from "../../hooks/settings/useCampaignSave";
import type { CampaignSummary } from "../../types/campaign-types";
import ContentInPlay from "./ContentInPlay";
import { gapWarning } from "./content-in-play";
import SettingsDisclosure from "./SettingsDisclosure";
import { contentSummary } from "./settings-summaries";
import { FormError, SettingsCard } from "./settings-ui";
import { SettingsRowsLoading } from "./SettingsSkeleton";

const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b).join();

/**
 * Settings → Content (the owner): the grade presets and the settings ticked, folded under what is
 * in play now. Saving changes what every list and picker greys out, so their cached lists are read
 * again.
 */
export default function ContentInPlayCard({ campaign }: { campaign: CampaignSummary }) {
  const { data, isLoading } = useSettingsList();
  const current = useMemo(() => campaign.setting_ids ?? [], [campaign.setting_ids]);
  const [picked, setPicked] = useState(current);
  const { saving, error, save } = useCampaignSave(
    campaign.id,
    "Couldn't save the content in play."
  );
  useEffect(() => setPicked(current), [current]);
  const settings = data?.settings ?? [];
  const presets = data?.presets ?? [];
  const changed = sorted(picked) !== sorted(current);
  const gap = data ? gapWarning(current, settings, presets) : "";

  // the answer, written over the cached campaign, marks the lists stale (writeCampaignAnswer)
  const submit = () => void save({ setting_ids: picked });

  return (
    <SettingsCard title="Content">
      <SettingsDisclosure
        title="Settings in play"
        summary={data ? contentSummary(current, settings, presets) : "Loading…"}
        warnings={gap ? [gap] : []}
      >
        {isLoading || !data ? (
          <SettingsRowsLoading label="Loading the settings in play" rows={2} />
        ) : (
          <ContentInPlay
            settings={settings}
            presets={presets}
            value={picked}
            onChange={setPicked}
            disabled={saving}
          />
        )}
        <FormError message={error} />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={saving || !changed}
            onClick={() => setPicked(current)}
          >
            Cancel
          </Button>
          <Button disabled={saving || !changed} onClick={submit}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </SettingsDisclosure>
    </SettingsCard>
  );
}
