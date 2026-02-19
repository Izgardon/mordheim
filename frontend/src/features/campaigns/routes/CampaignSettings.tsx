import { useNavigate, useOutletContext, useParams } from "react-router-dom";

// components
import { useEffect, useMemo, useState } from "react";

import TabbedCard from "@components/tabbed-card";
import { PageHeader } from "@components/page-header";
import DeleteCampaignCard from "../components/settings/DeleteCampaignCard";
import DeleteWarbandCard from "../components/settings/DeleteWarbandCard";
import CampaignControlCard from "../components/settings/CampaignControlCard";
import CampaignLevelUpSettingsCard from "../components/settings/CampaignLevelUpSettingsCard";
import MembersCard from "../components/settings/MembersCard";
import RemoveMemberDialog from "../components/settings/RemoveMemberDialog";
import SettingsHeader from "../components/settings/SettingsHeader";
import PersonalSettingsCard from "../components/settings/PersonalSettingsCard";
import WarbandDiceSettingsCard from "../components/settings/WarbandDiceSettingsCard";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";
import { useCampaignSettings } from "../hooks/use-campaign-settings";

// stores
import { useAppStore } from "@/stores/app-store";

// types
import type { CampaignLayoutContext } from "./CampaignLayout";

type SettingsTabId = "personal" | "campaign";

export default function CampaignSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const { warband, setWarband } = useAppStore();
  const campaignId = Number(id);

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of that campaign.</p>;
  }

  if (Number.isNaN(campaignId)) {
    return <p className="text-sm text-red-600">Invalid campaign id.</p>;
  }

  const isOwner = campaign.role === "owner";
  const canManageSettings = ["owner", "admin"].includes(campaign.role);
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    canManageSettings ? "campaign" : "personal"
  );

  useEffect(() => {
    if (!canManageSettings && activeTab !== "personal") {
      setActiveTab("personal");
    }
  }, [activeTab, canManageSettings]);

  const settingsTabs = useMemo(
    () => [
      { id: "personal" as const, label: "Personal" },
      { id: "campaign" as const, label: "Campaign" },
    ],
    []
  );

  const emptySettings = {
    members: [],
    error: "",
    isLoading: false,
    savingPermissions: {},
    savingRoles: {},
    memberErrors: {},
    deleteOpen: false,
    deleteValue: "",
    deleteError: "",
    isDeleting: false,
    removeTarget: null,
    removeOpen: false,
    removeError: "",
    isRemoving: false,
    canManagePermissions: false,
    canManageRoles: false,
    canRemoveMembers: false,
    isDeleteReady: false,
    formatPermissionsLabel: () => "None",
    handlePermissionToggle: () => Promise.resolve(),
    handleRoleToggle: () => Promise.resolve(),
    requestRemoveMember: () => {},
    closeRemoveDialog: () => {},
    handleRemoveMember: () => Promise.resolve(),
    setDeleteOpen: () => {},
    setDeleteValue: () => {},
    handleDeleteCampaign: () => Promise.resolve(),
    resetDeleteState: () => {},
  };

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
  } = canManageSettings
    ? useCampaignSettings({
        campaignId,
        campaignRole: campaign.role,
        onDeleted: () => navigate("/campaigns"),
      })
    : emptySettings;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle={campaign.name}
        tabs={canManageSettings ? settingsTabs : undefined}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as SettingsTabId)}
      />

      {canManageSettings ? (
        <div className="space-y-4">
          <TabbedCard
            tabs={settingsTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabsClassName="hidden"
            headerClassName="hidden"
            className="p-4 sm:p-7"
            contentClassName="pt-4 sm:pt-6"
          >
            {activeTab === "personal" ? (
              <div className="space-y-6">
                <PersonalSettingsCard onSignOut={signOut} />
                <WarbandDiceSettingsCard campaignRole={campaign.role} />
                {warband ? (
                  <DeleteWarbandCard
                    warbandId={warband.id}
                    warbandName={warband.name}
                    onDeleted={() => {
                      setWarband(null);
                      navigate(`/campaigns/${campaignId}`);
                    }}
                  />
                ) : null}
              </div>
            ) : (
              <div className="space-y-8">
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

                {isOwner ? <CampaignControlCard campaign={campaign} /> : null}
                {isOwner ? <CampaignLevelUpSettingsCard campaign={campaign} /> : null}

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
            )}
          </TabbedCard>
        </div>
      ) : (
        <div className="space-y-6">
          <PersonalSettingsCard onSignOut={signOut} />
          <WarbandDiceSettingsCard campaignRole={campaign.role} />
          {warband ? (
            <DeleteWarbandCard
              warbandId={warband.id}
              warbandName={warband.name}
              onDeleted={() => {
                setWarband(null);
                navigate(`/campaigns/${campaignId}`);
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
