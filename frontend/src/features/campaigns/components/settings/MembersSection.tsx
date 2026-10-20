// components
import HandOverDialog from "./HandOverDialog";
import MembersCard from "./MembersCard";
import RemoveMemberDialog from "./RemoveMemberDialog";

// hooks
import { campaignCapabilities } from "../../capabilities";
import { useHandOver } from "../../hooks/settings/useHandOver";
import { useMemberRemoval } from "../../hooks/settings/useMemberRemoval";
import { useMembers } from "../../hooks/settings/useMembers";

// types
import type { CampaignSummary } from "../../types/campaign-types";

/** Settings' members card (`view_members`): grants, roles, hand-over and Remove from campaign. */
export default function MembersSection({ campaign }: { campaign: CampaignSummary }) {
  const members = useMembers(campaign);
  const removal = useMemberRemoval(campaign.id);
  const handOver = useHandOver(campaign);

  return (
    <>
      {members.error ? <p className="text-sm text-red-600">{members.error}</p> : null}
      <MembersCard
        isLoading={members.isLoading}
        members={members.members}
        permissionOptions={members.permissionCatalogue}
        formatPermissionsLabel={members.formatPermissionsLabel}
        canManagePermissions={members.canManagePermissions}
        canManageRoles={members.canManageRoles}
        canRemoveMember={members.canRemoveMember}
        canHandOver={campaignCapabilities(campaign).hand_over}
        savingPermissions={members.savingPermissions}
        savingRoles={members.savingRoles}
        memberErrors={members.memberErrors}
        onTogglePermission={members.handlePermissionToggle}
        onToggleRole={members.handleRoleToggle}
        onRemoveRequest={removal.requestRemoveMember}
        onHandOverRequest={handOver.requestHandOver}
      />
      <RemoveMemberDialog
        campaignId={campaign.id}
        open={removal.removeOpen}
        target={removal.removeTarget}
        error={removal.removeError}
        isRemoving={removal.isRemoving}
        onClose={removal.closeRemoveDialog}
        onConfirm={removal.handleRemoveMember}
      />
      <HandOverDialog
        campaignName={campaign.name}
        target={handOver.target}
        error={handOver.error}
        isHandingOver={handOver.isHandingOver}
        onClose={handOver.closeHandOver}
        onConfirm={handOver.confirmHandOver}
      />
    </>
  );
}
