import { usePresetLocks } from "../../api/preset-queries";
import type { CampaignSummary } from "../../types/campaign-types";
import DefaultResource from "./DefaultResource";
import SettingsDisclosure from "./SettingsDisclosure";
import WyrdstonePrices from "./WyrdstonePrices";

/**
 * Settings → Rules → Main resource (`edit_settings`): the default resource's name and its sell
 * prices. A published campaign that names the resource (Treasure in Marienburg) leaves no name to
 * type (William, 23 Nov 2026).
 */
export default function ResourceSection({ campaign }: { campaign: CampaignSummary }) {
  const locks = usePresetLocks(campaign.id);
  const name = campaign.default_resource_name?.trim() || "Wyrdstone";
  return (
    <SettingsDisclosure title="Main resource" summary={`${name} and its sell prices`}>
      {locks.sets.has("default_resource_name") ? null : <DefaultResource campaign={campaign} />}
      <WyrdstonePrices campaign={campaign} />
    </SettingsDisclosure>
  );
}
