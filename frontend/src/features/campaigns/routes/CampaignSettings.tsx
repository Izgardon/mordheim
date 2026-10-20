import { useNavigate, useOutletContext, useParams } from "react-router-dom";

// components
import { useEffect, useMemo, useState } from "react";

import TabbedCard from "@components/tabbed-card";
import { PageHeader } from "@components/page-header";
import ActiveBattlesTable from "../components/settings/ActiveBattlesTable";
import DeleteCampaignCard from "../components/settings/DeleteCampaignCard";
import DeleteWarbandCard from "../components/settings/DeleteWarbandCard";
import CampaignControlCard from "../components/settings/CampaignControlCard";
import CampaignLevelUpSettingsCard from "../components/settings/CampaignLevelUpSettingsCard";
import FeedbackReportCard from "../components/settings/FeedbackReportCard";
import JoinCodeBadge from "../components/settings/JoinCodeBadge";
import MembersCard from "../components/settings/MembersCard";
import RemoveMemberDialog from "../components/settings/RemoveMemberDialog";
import PersonalSettingsCard from "../components/settings/PersonalSettingsCard";
import WarbandDiceSettingsCard from "../components/settings/WarbandDiceSettingsCard";
import WarbandSettingsCard from "../components/settings/WarbandSettingsCard";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";
import { useCampaignSettings } from "../hooks/use-campaign-settings";
import { useMyWarbandWriter } from "@/features/warbands/hooks/warband/useMyWarbandStore";

// stores
import { useAppStore } from "@/stores/app-store";

// types
import type { CampaignLayoutContext } from "./CampaignLayout";

type SettingsTabId = "personal" | "campaign";

export default function CampaignSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { campaign, setCampaign } = useOutletContext<CampaignLayoutContext>();
  const { warband } = useAppStore();
  const campaignId = Number(id);
  const myWarband = useMyWarbandWriter(Number.isNaN(campaignId) ? null : campaignId);
  const canManageSettings = campaign ? ["owner", "admin"].includes(campaign.role) : false;
  // A player granted manage_battles gets the Campaign tab for Active Battles alone (BATL-NEW-03).
  const hasCampaignTab =
    canManageSettings || Boolean(campaign?.permissions?.includes("manage_battles"));
  const [activeTab, setActiveTab] = useState<SettingsTabId>("personal");
  const handleOpenCampaigns = useMemo(() => () => navigate("/campaigns"), [navigate]);

  useEffect(() => {
    if (!hasCampaignTab && activeTab !== "personal") {
      setActiveTab("personal");
    }
  }, [activeTab, hasCampaignTab]);

  const settingsTabs = useMemo(
    () => [
      { id: "personal" as const, label: "Personal" },
      { id: "campaign" as const, label: "Campaign" },
    ],
    []
  );

  // Called for every viewer so the hook order never depends on the role (or on the guards
  // below). The hook only fetches members / active battles for owners and admins.
  const {
    members,
    activeBattles,
    error,
    activeBattlesError,
    isLoading,
    isActiveBattlesLoading,
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
    canRemoveMember,
    canManageActiveBattles,
    isDeleteReady,
    permissionCatalogue,
    formatPermissionsLabel,
    handlePermissionToggle,
    handleRoleToggle,
    requestRemoveMember,
    closeRemoveDialog,
    handleRemoveMember,
    setDeleteOpen,
    setDeleteValue,
    handleDeleteCampaign,
    handleCancelActiveBattle,
    handleCloseActiveBattle,
    handleEndActiveBattle,
    handleConfirmActiveBattleResults,
    resetDeleteState,
  } = useCampaignSettings({
    campaignId,
    campaignRole: campaign?.role,
    campaignPermissions: campaign?.permissions,
    onDeleted: () => navigate("/campaigns"),
  });

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of that campaign.</p>;
  }

  if (Number.isNaN(campaignId)) {
    return <p className="text-sm text-red-600">Invalid campaign id.</p>;
  }

  const isOwner = campaign.role === "owner";
  const joinCode = (compact: boolean) =>
    campaign.join_code ? (
      <JoinCodeBadge
        campaign={campaign}
        canRegenerate={canManageSettings}
        onRegenerated={(updated) => setCampaign?.(updated)}
        compact={compact}
      />
    ) : undefined;

  const personalSettingsContent = (
    <div className="space-y-6">
      <PersonalSettingsCard onSignOut={signOut} onOpenCampaigns={handleOpenCampaigns} />
      <WarbandDiceSettingsCard campaignRole={campaign.role} />
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
      {warband ? (
        <DeleteWarbandCard
          warbandId={warband.id}
          warbandName={warband.name}
          onDeleted={() => {
            myWarband.remove(warband.id);
            navigate(`/campaigns/${campaignId}`);
          }}
        />
      ) : null}
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle={campaign.name}
        tabs={hasCampaignTab ? settingsTabs : undefined}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as SettingsTabId)}
        rightSlot={joinCode(false)}
      />

      {hasCampaignTab ? (
        <div className="space-y-4">
          <TabbedCard
            tabs={settingsTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabsClassName="hidden"
            headerClassName="hidden"
            className="px-2 pb-6 sm:px-0"
            contentClassName="pt-4 sm:pt-0"
            mobileRight={joinCode(true)}
          >
            {activeTab === "personal" ? (
              personalSettingsContent
            ) : (
              <div className="space-y-8">
                {canManageSettings && error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : null}

                {canManageSettings ? (
                  <MembersCard
                    isLoading={isLoading}
                    members={members}
                    permissionOptions={permissionCatalogue}
                    formatPermissionsLabel={formatPermissionsLabel}
                    canManagePermissions={canManagePermissions}
                    canManageRoles={canManageRoles}
                    canRemoveMember={canRemoveMember}
                    savingPermissions={savingPermissions}
                    savingRoles={savingRoles}
                    memberErrors={memberErrors}
                    onTogglePermission={handlePermissionToggle}
                    onToggleRole={handleRoleToggle}
                    onRemoveRequest={requestRemoveMember}
                  />
                ) : null}

                {canManageActiveBattles ? (
                  <ActiveBattlesTable
                    isLoading={isActiveBattlesLoading}
                    error={activeBattlesError}
                    battles={activeBattles}
                    onCancelBattle={handleCancelActiveBattle}
                    onCloseBattle={handleCloseActiveBattle}
                    onEndBattle={handleEndActiveBattle}
                    onConfirmResults={handleConfirmActiveBattleResults}
                  />
                ) : null}

                {isOwner ? (
                  <CampaignControlCard
                    campaign={campaign}
                    onCampaignUpdated={(updated) => setCampaign?.(updated)}
                  />
                ) : null}
                {isOwner ? (
                  <CampaignLevelUpSettingsCard
                    campaign={campaign}
                    onCampaignUpdated={(updated) => setCampaign?.(updated)}
                  />
                ) : null}

                {isOwner ? (
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
                  campaignId={campaignId}
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
        personalSettingsContent
      )}
    </div>
  );
}
