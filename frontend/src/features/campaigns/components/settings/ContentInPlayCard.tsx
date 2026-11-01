import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { useSettingsList } from "../../api/settings-queries";
import type { CampaignSummary } from "../../types/campaign-types";
import ContentInPlay from "./ContentInPlay";
import { useCampaignSave } from "./CampaignSection";
import { FormError, SettingsCard } from "./settings-ui";
import { SettingsRowsLoading } from "./SettingsSkeleton";

const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b).join();

/**
 * Settings → Campaign → Content in play (the owner): the grade presets and the settings ticked.
 * Saving changes what every list and picker greys out, so their cached lists are read again.
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
  const changed = sorted(picked) !== sorted(current);

  // the answer, written over the cached campaign, marks the lists stale (writeCampaignAnswer)
  const submit = () => void save({ setting_ids: picked });

  return (
    <SettingsCard title="Content in play">
      {isLoading || !data ? (
        <SettingsRowsLoading label="Loading the settings in play" rows={2} />
      ) : (
        <ContentInPlay
          settings={settings}
          presets={data.presets}
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
    </SettingsCard>
  );
}
