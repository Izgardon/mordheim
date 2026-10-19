import { useNavigate, useOutletContext, useParams } from "react-router-dom";

// components
import { useEffect, useMemo, useState } from "react";

import TabbedCard from "@components/tabbed-card";
import { PageHeader } from "@components/page-header";
import { ConfirmDialog } from "@components/confirm-dialog";
import ActiveBattlesTable from "../components/settings/ActiveBattlesTable";
import DeleteCampaignCard from "../components/settings/DeleteCampaignCard";
import DeleteWarbandCard from "../components/settings/DeleteWarbandCard";
import CampaignControlCard from "../components/settings/CampaignControlCard";
import CampaignLevelUpSettingsCard from "../components/settings/CampaignLevelUpSettingsCard";
import FeedbackReportCard from "../components/settings/FeedbackReportCard";
import MembersCard from "../components/settings/MembersCard";
import RemoveMemberDialog from "../components/settings/RemoveMemberDialog";
import PersonalSettingsCard from "../components/settings/PersonalSettingsCard";
import WarbandDiceSettingsCard from "../components/settings/WarbandDiceSettingsCard";
import WarbandSettingsCard from "../components/settings/WarbandSettingsCard";

import type { CampaignMember } from "../types/campaign-types";

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
    kickTarget,
    kickOpen,
    kickError,
    isKicking,
    canManagePermissions,
    canManageRoles,
    canRemoveMembers,
    canManageActiveBattles,
    isDeleteReady,
    formatPermissionsLabel,
    handlePermissionToggle,
    handleRoleToggle,
    requestRemoveMember,
    closeRemoveDialog,
    handleRemoveMember,
    requestKickPlayer,
    closeKickDialog,
    handleKickPlayer,
    setDeleteOpen,
    setDeleteValue,
    handleDeleteCampaign,
    handleCancelActiveBattle,
    handleCloseActiveBattle,
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
        rightSlot={
          campaign.join_code ? (
            <div className="flex flex-col items-end">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Join Code</p>
              <p className="font-mono text-sm font-semibold text-foreground">
                {campaign.join_code}
              </p>
            </div>
          ) : undefined
        }
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
            mobileRight={
              campaign.join_code ? (
                <div className="text-right">
                  <p className="text-[0.5rem] uppercase tracking-[0.2em] text-muted-foreground">
                    Join Code
                  </p>
                  <p className="font-mono text-[0.65rem] font-semibold text-foreground">
                    {campaign.join_code}
                  </p>
                </div>
              ) : undefined
            }
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
                    formatPermissionsLabel={formatPermissionsLabel}
                    canManagePermissions={canManagePermissions}
                    canManageRoles={canManageRoles}
                    canRemoveMembers={canRemoveMembers}
                    savingPermissions={savingPermissions}
                    savingRoles={savingRoles}
                    memberErrors={memberErrors}
                    onTogglePermission={handlePermissionToggle}
                    onToggleRole={handleRoleToggle}
                    onRemoveRequest={requestRemoveMember}
                    canKickPlayers={isOwner}
                    onKickRequest={requestKickPlayer}
                  />
                ) : null}

                {canManageActiveBattles ? (
                  <ActiveBattlesTable
                    isLoading={isActiveBattlesLoading}
                    error={activeBattlesError}
                    battles={activeBattles}
                    onCancelBattle={handleCancelActiveBattle}
                    onCloseBattle={handleCloseActiveBattle}
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
                <KickPlayerDialog
                  open={kickOpen}
                  target={kickTarget}
                  error={kickError}
                  isKicking={isKicking}
                  onClose={closeKickDialog}
                  onConfirm={handleKickPlayer}
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

type KickPlayerDialogProps = {
  open: boolean;
  target: CampaignMember | null;
  error: string;
  isKicking: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function KickPlayerDialog({
  open,
  target,
  error,
  isKicking,
  onClose,
  onConfirm,
}: KickPlayerDialogProps) {
  const description = (
    <div className="space-y-2">
      <p>
        Delete{" "}
        <span className="font-semibold text-foreground">
          {target?.warband_name ?? "this warband"}
        </span>
        ? This will permanently remove the warband and all its units.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      description={description}
      confirmText={isKicking ? "Kicking..." : "Kick player"}
      confirmVariant="destructive"
      confirmDisabled={isKicking || !target}
      isConfirming={isKicking}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
