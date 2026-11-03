import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { CampaignSummary } from "../../types/campaign-types";
import { useCampaignSave } from "./CampaignSection";
import { SettingRow } from "./settings-ui";

/**
 * The name of every warband's default resource (`edit_settings`): a rename renames it in each
 * warband; one that already has a resource of the new name has it merged in, which the server
 * warns about.
 */
export default function DefaultResource({ campaign }: { campaign: CampaignSummary }) {
  const current = campaign.default_resource_name ?? "Wyrdstone";
  const [name, setName] = useState(current);
  const { saving, error, save } = useCampaignSave(campaign.id, "Couldn't rename it.");
  useEffect(() => setName(current), [current]);
  const trimmed = name.trim();

  return (
    <SettingRow label="Default resource" error={error}>
      <Input
        aria-label="Default resource"
        value={name}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        className="w-[220px] max-[960px]:min-w-0 max-[960px]:flex-1"
      />
      <Button
        variant="secondary"
        disabled={saving || !trimmed || trimmed === current}
        onClick={() => void save({ default_resource_name: trimmed })}
      >
        {saving ? "Saving…" : "Rename"}
      </Button>
    </SettingRow>
  );
}
