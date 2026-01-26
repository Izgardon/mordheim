import { useNavigate, useOutletContext, useParams } from "react-router-dom";

// components
import DeleteCampaignCard from "../components/settings/DeleteCampaignCard";
import CampaignControlCard from "../components/settings/CampaignControlCard";
import MembersCard from "../components/settings/MembersCard";
import RemoveMemberDialog from "../components/settings/RemoveMemberDialog";
import SettingsHeader from "../components/settings/SettingsHeader";

// hooks
import { useCampaignSettings } from "../hooks/use-campaign-settings";

// types
import type { CampaignLayoutContext } from "./CampaignLayout";

export default function CampaignSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const campaignId = Number(id);

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of that campaign.</p>;
  }

  if (!["owner", "admin"].includes(campaign.role)) {
    return (
      <p className="text-sm text-muted-foreground">
        Only campaign owners and admins can manage settings.
      </p>
    );
  }

  if (Number.isNaN(campaignId)) {
    return <p className="text-sm text-red-600">Invalid campaign id.</p>;
  }

  const isOwner = campaign.role === "owner";

  const {
    members,
    error,
    isLoading,
    savingPermissions,
    savingRoles,
    memberErrors,
    deleteOpen,
    deleteValue,
    deleteError,
    isDeleting,
    removeTarget,
    removeOpen,
    removeError,
    isRemoving,
    canManagePermissions,
    canManageRoles,
    canRemoveMembers,
    isDeleteReady,
    formatPermissionsLabel,
    handlePermissionToggle,
    handleRoleToggle,
    requestRemoveMember,
    closeRemoveDialog,
    handleRemoveMember,
    setDeleteOpen,
    setDeleteValue,
    handleDeleteCampaign,
    resetDeleteState,
  } = useCampaignSettings({
    campaignId,
    campaignRole: campaign.role,
    onDeleted: () => navigate("/campaigns"),
  });

  return (
    <div className="space-y-8">
      <SettingsHeader campaign={campaign} />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <MembersCard
        isLoading={isLoading}
        members={members}
        formatPermissionsLabel={formatPermissionsLabel}
        canManagePermissions={canManagePermissions}
        canManageRoles={canManageRoles}
        savingPermissions={savingPermissions}
        savingRoles={savingRoles}
        memberErrors={memberErrors}
        onTogglePermission={handlePermissionToggle}
        onToggleRole={handleRoleToggle}
        onRemoveRequest={requestRemoveMember}
        canRemoveMembers={canRemoveMembers}
      />

      {isOwner ? (
        <CampaignControlCard campaignId={campaignId} inProgress={campaign.in_progress} />
      ) : null}

      {canRemoveMembers ? (
        <DeleteCampaignCard
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onReset={resetDeleteState}
          deleteValue={deleteValue}
          onDeleteValueChange={setDeleteValue}
          isDeleteReady={isDeleteReady}
          deleteError={deleteError}
          isDeleting={isDeleting}
          onDelete={handleDeleteCampaign}
        />
      ) : null}

      <RemoveMemberDialog
        open={removeOpen}
        target={removeTarget}
        error={removeError}
        isRemoving={isRemoving}
        onClose={closeRemoveDialog}
        onConfirm={handleRemoveMember}
      />
    </div>
  );
}
