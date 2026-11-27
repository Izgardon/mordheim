import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryKeys } from "@/lib/query-keys";

import { useCampaignSave } from "../../hooks/settings/useCampaignSave";
import type { CampaignSummary } from "../../types/campaign-types";
import { SettingRow, SettingsCard } from "./settings-ui";

/**
 * Settings → Campaign, first of all (William, 27 Nov 2026: "campaign name should be top"): the
 * owner renames the campaign, and the campaigns list shows the new name too.
 */
export default function CampaignBasics({ campaign }: { campaign: CampaignSummary }) {
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
    <SettingsCard title="Campaign">
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
    </SettingsCard>
  );
}
