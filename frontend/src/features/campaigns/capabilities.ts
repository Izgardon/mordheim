import { useMemo } from "react";

// api
import { useCampaignQuery } from "./hooks/useCampaignQuery";

// types
import type { CampaignMember, CampaignSummary } from "./types/campaign-types";

/**
 * What the viewer may do in a campaign, as the campaign detail reports it (design 0.29,
 * `apps/campaigns/access.py`). This is the only module that knows roles and permission codes:
 * pages gate their controls on these flags, never on `campaign.role` or the codes (the lint rule
 * in `eslint.config.js` keeps it that way).
 */
export const CAMPAIGN_CAPABILITIES = [
  "edit_settings",
  "start",
  "delete",
  "regenerate_join_code",
  "view_members",
  "grant_permissions",
  "change_roles",
  "remove_members",
  "add_custom",
  "manage_items",
  "manage_skills",
  "manage_spells",
  "manage_specials",
  "manage_rules",
  "manage_warbands",
  "manage_encampments",
  "manage_locations",
  "manage_bestiary",
  "manage_battles",
] as const;

export type CampaignCapability = (typeof CAMPAIGN_CAPABILITIES)[number];
export type Capabilities<K extends string> = Readonly<Record<K, boolean>>;
export type CampaignCapabilities = Capabilities<CampaignCapability>;

/** Missing payloads and unknown keys read as false: the UI fails closed. */
export function readCapabilities<K extends string>(
  keys: readonly K[],
  raw: unknown
): Capabilities<K> {
  const source = (raw ?? {}) as Partial<Record<string, unknown>>;
  return Object.fromEntries(keys.map((key) => [key, source[key] === true])) as Capabilities<K>;
}

/** The flags of a campaign payload (every flag false without one). */
export function campaignCapabilities(
  campaign: Pick<CampaignSummary, "capabilities"> | null | undefined
): CampaignCapabilities {
  return readCapabilities(CAMPAIGN_CAPABILITIES, campaign?.capabilities);
}

/** The viewer's flags from the cached campaign detail (the layout's query). */
export function useCampaignCapabilities(campaignId: number): CampaignCapabilities {
  const { data } = useCampaignQuery(campaignId);
  const raw = data?.capabilities;
  return useMemo(() => readCapabilities(CAMPAIGN_CAPABILITIES, raw), [raw]);
}

/**
 * Whether the viewer may remove this member (decision 1, as `services/removal.check_may_remove`
 * rules): nobody removes the owner, the owner removes anyone else (admins included), and admins
 * remove players. `remove_members` says the viewer may remove anyone at all.
 */
export function canRemoveMember(
  campaign: Pick<CampaignSummary, "role" | "capabilities">,
  member: Pick<CampaignMember, "role">
) {
  if (!campaignCapabilities(campaign).remove_members || member.role === "owner") {
    return false;
  }
  return member.role === "player" || campaign.role === "owner";
}

/** The Settings → Campaign tab appears for anyone holding a capability for one of its cards. */
export function hasCampaignSettings(capabilities: CampaignCapabilities) {
  return (
    capabilities.view_members ||
    capabilities.manage_battles ||
    capabilities.edit_settings ||
    capabilities.delete
  );
}
