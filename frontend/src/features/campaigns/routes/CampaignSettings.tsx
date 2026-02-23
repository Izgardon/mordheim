import { useNavigate, useOutletContext, useParams } from "react-router-dom";

// components
import { useEffect, useMemo, useState } from "react";

import TabbedCard from "@components/tabbed-card";
import { PageHeader } from "@components/page-header";
import { ConfirmDialog } from "@components/confirm-dialog";
import DeleteCampaignCard from "../components/settings/DeleteCampaignCard";
import DeleteWarbandCard from "../components/settings/DeleteWarbandCard";
import CampaignControlCard from "../components/settings/CampaignControlCard";
import CampaignLevelUpSettingsCard from "../components/settings/CampaignLevelUpSettingsCard";
import MembersCard from "../components/settings/MembersCard";
import RemoveMemberDialog from "../components/settings/RemoveMemberDialog";
import SettingsHeader from "../components/settings/SettingsHeader";
import PersonalSettingsCard from "../components/settings/PersonalSettingsCard";
import WarbandDiceSettingsCard from "../components/settings/WarbandDiceSettingsCard";

import type { CampaignMember } from "../types/campaign-types";

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
    kickTarget: null,
    kickOpen: false,
    kickError: "",
    isKicking: false,
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
    requestKickPlayer: () => {},
    closeKickDialog: () => {},
    handleKickPlayer: () => Promise.resolve(),
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
    kickTarget,
    kickOpen,
    kickError,
    isKicking,
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
    requestKickPlayer,
    closeKickDialog,
    handleKickPlayer,
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
                <PersonalSettingsCard onSignOut={signOut} joinCode={campaign.join_code} />
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
                  canKickPlayers={isOwner}
                  onKickRequest={requestKickPlayer}
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
        <div className="space-y-6">
          <PersonalSettingsCard onSignOut={signOut} joinCode={campaign.join_code} />
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

type KickPlayerDialogProps = {
  open: boolean;
  target: CampaignMember | null;
  error: string;
  isKicking: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function KickPlayerDialog({ open, target, error, isKicking, onClose, onConfirm }: KickPlayerDialogProps) {
  const description = (
    <div className="space-y-2">
      <p>
        Delete <span className="font-semibold text-foreground">{target?.warband_name ?? "this warband"}</span>?
        This will permanently remove the warband and all its units.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
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
