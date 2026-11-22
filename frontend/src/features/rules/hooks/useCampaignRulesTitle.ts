import { useCampaignPresets } from "@/features/campaigns/api/preset-queries";

/**
 * The Campaign rules page's title: the published campaign it plays, Mordheim when it plays none
 * (William, 22 Nov 2026: "can the title be the setting selected or Mordheim if nothing
 * selected"). The page's heading and, on a phone, the top bar both read it; the preset list is the
 * dropdown's, read once a session.
 */
export function useCampaignRulesTitle(presetId: number | null | undefined, enabled = true) {
  const presets = useCampaignPresets({ enabled });
  return presets.data?.find((preset) => preset.id === presetId)?.name ?? "Mordheim";
}
