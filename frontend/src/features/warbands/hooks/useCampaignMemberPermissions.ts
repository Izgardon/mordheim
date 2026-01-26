import { useEffect, useState } from "react";

import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";

import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

type UseCampaignMemberPermissionsParams = {
  campaignId: number;
  campaign: CampaignLayoutContext["campaign"] | null;
};

export function useCampaignMemberPermissions({
  campaignId,
  campaign,
}: UseCampaignMemberPermissionsParams) {
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (Number.isNaN(campaignId)) {
      setMemberPermissions([]);
      return;
    }
    if (!campaign || campaign.role !== "player") {
      setMemberPermissions([]);
      return;
    }

    let isActive = true;

    const loadPermissions = async () => {
      try {
        const permissions = await listMyCampaignPermissions(campaignId);
        if (isActive) {
          setMemberPermissions(permissions.map((permission) => permission.code));
        }
      } catch {
        if (isActive) {
          setMemberPermissions([]);
        }
      }
    };

    loadPermissions();

    return () => {
      isActive = false;
    };
  }, [campaign, campaignId]);

  return { memberPermissions };
}
