import { useNavigate } from "react-router-dom";

// components
import DeleteWarbandCard from "./DeleteWarbandCard";
import FeedbackReportCard from "./FeedbackReportCard";
import LeaveCampaignCard from "./LeaveCampaignCard";
import PersonalSettingsCard from "./PersonalSettingsCard";
import WarbandDiceSettingsCard from "./WarbandDiceSettingsCard";
import WarbandSettingsCard from "./WarbandSettingsCard";

// hooks
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMyWarbandWriter } from "@/features/warbands/hooks/warband/useMyWarbandStore";

// stores
import { useAppStore } from "@/stores/app-store";

// types
import type { CampaignCapabilities } from "../../capabilities";
import type { CampaignSummary } from "../../types/campaign-types";

type PersonalSettingsTabProps = {
  campaign: CampaignSummary;
  capabilities: CampaignCapabilities;
};

/** Settings → Personal: your account, your warband's settings and dice, and feedback. */
export default function PersonalSettingsTab({ campaign, capabilities }: PersonalSettingsTabProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { warband } = useAppStore();
  const myWarband = useMyWarbandWriter(campaign.id);

  return (
    <div className="space-y-6">
      <PersonalSettingsCard onSignOut={signOut} onOpenCampaigns={() => navigate("/campaigns")} />
      <WarbandDiceSettingsCard canEditAnyWarband={capabilities.manage_warbands} />
      {warband ? (
        <WarbandSettingsCard
          warband={warband}
          canEdit={true}
          onWarbandUpdated={(updated) => myWarband.merge(updated.id, updated)}
        />
      ) : null}
      <FeedbackReportCard
        campaignId={campaign.id}
        campaignName={campaign.name}
        warbandId={warband?.id}
        warbandName={warband?.name}
      />
      <LeaveCampaignCard campaign={campaign} />
      {warband ? (
        <DeleteWarbandCard
          warbandId={warband.id}
          warbandName={warband.name}
          onDeleted={() => {
            myWarband.remove(warband.id);
            navigate(`/campaigns/${campaign.id}`);
          }}
        />
      ) : null}
    </div>
  );
}
