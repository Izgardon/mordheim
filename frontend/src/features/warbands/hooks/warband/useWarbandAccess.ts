import { useAuth } from "../../../auth/hooks/use-auth";
import { useCampaignPermissions } from "../../../campaigns/hooks/useCampaignQuery";

import type { CampaignRole } from "../../../campaigns/types/campaign-types";
import type { Warband } from "../../types/warband-types";

/**
 * Who may do what on the warband page: the warband's owner, or a campaign owner/admin, or a
 * member holding the permission (`manage_warbands` to edit, `add_custom` for custom entries).
 */
export function useWarbandAccess(
  campaignId: number,
  role: CampaignRole | undefined,
  warband: Warband | null
) {
  const { user } = useAuth();
  const memberPermissions = useCampaignPermissions(campaignId);
  const hasPermission = (permission: string) =>
    role === "owner" || role === "admin" || memberPermissions.includes(permission);
  const isWarbandOwner = Boolean(warband && user && warband.user_id === user.id);
  return {
    user,
    isWarbandOwner,
    canEdit: Boolean(warband) && (isWarbandOwner || hasPermission("manage_warbands")),
    canAddCustom: hasPermission("add_custom"),
  };
}
