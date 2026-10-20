import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import {
  cancelCampaignActiveBattle,
  deleteCampaign,
  listCampaignActiveBattles,
  listCampaignMembers,
  removeCampaignMember,
  updateMemberPermissions,
  updateMemberRole,
} from "../api/campaigns-api";
import {
  closePostbattle,
  confirmBattleResults,
  finishBattle,
} from "@/features/battles/api/battles-api";
import { invalidateOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";

import { usePermissionCatalogue } from "./useCampaignQuery";
import { apiErrorCode } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

// types
import type { CampaignActiveBattle, CampaignMember } from "../types/campaign-types";

type UseCampaignSettingsParams = {
  campaignId: number;
  campaignRole?: CampaignMember["role"];
  /** The viewer's campaign permission codes; `manage_battles` opens Active Battles. */
  campaignPermissions?: string[];
  onDeleted: () => void;
};

export function useCampaignSettings({
  campaignId,
  campaignRole,
  campaignPermissions,
  onDeleted,
}: UseCampaignSettingsParams) {
  // Active Battles is for anyone with manage_battles (owners and admins have it), as the server
  // rules (BATL-NEW-03).
  const canManageActiveBattles = Boolean(campaignPermissions?.includes("manage_battles"));
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [activeBattles, setActiveBattles] = useState<CampaignActiveBattle[]>([]);
  const [error, setError] = useState("");
  const [activeBattlesError, setActiveBattlesError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isActiveBattlesLoading, setIsActiveBattlesLoading] = useState(canManageActiveBattles);
  const [savingPermissions, setSavingPermissions] = useState<Record<number, boolean>>({});
  const [savingRoles, setSavingRoles] = useState<Record<number, boolean>>({});
  const [memberErrors, setMemberErrors] = useState<Record<number, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteValue, setDeleteValue] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CampaignMember | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);

  const canManagePermissions = campaignRole === "owner" || campaignRole === "admin";
  const canManageRoles = campaignRole === "owner";
  // The owner removes anyone but themself, admins included; admins remove players; nobody
  // removes the owner (decision 1, as the server rules).
  const canRemoveMember = (member: CampaignMember) =>
    member.role !== "owner" && (campaignRole === "owner" || member.role === "player");
  const isDeleteReady = deleteValue.trim().toLowerCase() === "delete";

  // The grant menu's codes, labels and descriptions come from the server (BUG-15).
  const queryClient = useQueryClient();
  const catalogueQuery = usePermissionCatalogue(campaignId, { enabled: canManagePermissions });
  const permissionCatalogue = useMemo(() => catalogueQuery.data ?? [], [catalogueQuery.data]);
  const permissionLabelMap = useMemo(
    () => new Map(permissionCatalogue.map((option) => [option.code, option.label])),
    [permissionCatalogue]
  );

  useEffect(() => {
    if (!campaignRole || !["owner", "admin"].includes(campaignRole) || Number.isNaN(campaignId)) {
      return;
    }

    setIsLoading(true);
    setError("");

    listCampaignMembers(campaignId)
      .then((membersData) => {
        setMembers(membersData);
        setMemberErrors({});
        setSavingPermissions({});
        setSavingRoles({});
      })
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load settings");
        } else {
          setError("Unable to load settings");
        }
      })
      .finally(() => setIsLoading(false));
  }, [campaignRole, campaignId]);

  useEffect(() => {
    if (!canManageActiveBattles || Number.isNaN(campaignId)) {
      setActiveBattles([]);
      setActiveBattlesError("");
      setIsActiveBattlesLoading(false);
      return;
    }

    setIsActiveBattlesLoading(true);
    setActiveBattlesError("");

    listCampaignActiveBattles(campaignId)
      .then((data) => {
        setActiveBattles(data);
      })
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setActiveBattlesError(errorResponse.message || "Unable to load active battles");
        } else {
          setActiveBattlesError("Unable to load active battles");
        }
      })
      .finally(() => setIsActiveBattlesLoading(false));
  }, [campaignId, canManageActiveBattles]);

  const formatPermissionsLabel = (codes: string[]) => {
    if (codes.length === 0) {
      return "None";
    }
    return codes.map((code) => permissionLabelMap.get(code) || code).join(", ");
  };

  const handlePermissionToggle = async (memberId: number, code: string) => {
    if (!canManagePermissions || Number.isNaN(campaignId)) {
      return;
    }

    const target = members.find((member) => member.id === memberId);
    if (!target || target.role !== "player") {
      return;
    }

    const previousPermissions = target.permissions;
    const nextPermissions = previousPermissions.includes(code)
      ? previousPermissions.filter((item) => item !== code)
      : [...previousPermissions, code];

    setMembers((prev) =>
      prev.map((member) =>
        member.id === memberId ? { ...member, permissions: nextPermissions } : member
      )
    );
    setMemberErrors((prev) => ({ ...prev, [memberId]: "" }));
    setSavingPermissions((prev) => ({ ...prev, [memberId]: true }));

    try {
      const updated = await updateMemberPermissions(campaignId, memberId, nextPermissions);
      const updatedCodes = updated.map((permission) => permission.code);
      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberId ? { ...member, permissions: updatedCodes } : member
        )
      );
    } catch (errorResponse) {
      const message =
        errorResponse instanceof Error
          ? errorResponse.message || "Unable to update permissions"
          : "Unable to update permissions";
      setMemberErrors((prev) => ({ ...prev, [memberId]: message }));
      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberId ? { ...member, permissions: previousPermissions } : member
        )
      );
      if (apiErrorCode(errorResponse) === "unknown_permission") {
        // The menu offered a code the server no longer has: read the codes again.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.campaign.permissionCatalogue(campaignId),
        });
      }
    } finally {
      setSavingPermissions((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  const handleRoleToggle = async (member: CampaignMember) => {
    if (!canManageRoles || Number.isNaN(campaignId)) {
      return;
    }
    if (member.role === "owner") {
      return;
    }

    const previousRole = member.role;
    const nextRole = member.role === "admin" ? "player" : "admin";

    setMembers((prev) =>
      prev.map((entry) => (entry.id === member.id ? { ...entry, role: nextRole } : entry))
    );
    setMemberErrors((prev) => ({ ...prev, [member.id]: "" }));
    setSavingRoles((prev) => ({ ...prev, [member.id]: true }));

    try {
      const updated = await updateMemberRole(campaignId, member.id, nextRole);
      setMembers((prev) =>
        prev.map((entry) => (entry.id === member.id ? { ...entry, role: updated.role } : entry))
      );
    } catch (errorResponse) {
      const message =
        errorResponse instanceof Error
          ? errorResponse.message || "Unable to update role"
          : "Unable to update role";
      setMemberErrors((prev) => ({ ...prev, [member.id]: message }));
      setMembers((prev) =>
        prev.map((entry) => (entry.id === member.id ? { ...entry, role: previousRole } : entry))
      );
    } finally {
      setSavingRoles((prev) => ({ ...prev, [member.id]: false }));
    }
  };

  const requestRemoveMember = (member: CampaignMember) => {
    setRemoveTarget(member);
    setRemoveOpen(true);
    setRemoveError("");
  };

  const closeRemoveDialog = () => {
    setRemoveOpen(false);
    setRemoveTarget(null);
    setRemoveError("");
  };

  const handleRemoveMember = async () => {
    if (!removeTarget || Number.isNaN(campaignId)) {
      return;
    }

    setIsRemoving(true);
    setRemoveError("");

    try {
      await removeCampaignMember(campaignId, removeTarget.id);
      setMembers((prev) => prev.filter((member) => member.id !== removeTarget.id));
      closeRemoveDialog();
      // Their open battles were cancelled or skipped them.
      void invalidateOpenBattles(queryClient, campaignId);
      if (canManageActiveBattles) {
        setActiveBattles(await listCampaignActiveBattles(campaignId));
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setRemoveError(errorResponse.message || "Unable to remove member");
      } else {
        setRemoveError("Unable to remove member");
      }
    } finally {
      setIsRemoving(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (Number.isNaN(campaignId)) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteCampaign(campaignId);
      onDeleted();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setDeleteError(errorResponse.message || "Unable to close campaign");
      } else {
        setDeleteError("Unable to close campaign");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const resetDeleteState = () => {
    setDeleteValue("");
    setDeleteError("");
  };

  const handleCancelActiveBattle = async (battleId: number) => {
    if (!canManageActiveBattles || Number.isNaN(campaignId)) {
      return;
    }

    const updated = await cancelCampaignActiveBattle(campaignId, battleId);
    setActiveBattles((prev) => prev.filter((entry) => entry.battle.id !== updated.battle.id));
  };

  const handleCloseActiveBattle = async (battleId: number) => {
    if (!canManageActiveBattles || Number.isNaN(campaignId)) {
      return;
    }
    await closePostbattle(campaignId, battleId);
    setActiveBattles((prev) => prev.filter((entry) => entry.battle.id !== battleId));
  };

  // End a stuck fight, or confirm its results (BATL-NEW-03): the battle moves on, and its row's
  // tools with it, so the list is read again.
  const resultsWrite =
    (send: typeof finishBattle) =>
    async (battleId: number, results: { winners: number[]; losers: number[] }) => {
      if (!canManageActiveBattles || Number.isNaN(campaignId)) {
        return;
      }
      await send(campaignId, battleId, results);
      setActiveBattles(await listCampaignActiveBattles(campaignId));
    };
  const handleEndActiveBattle = resultsWrite(finishBattle);
  const handleConfirmActiveBattleResults = resultsWrite(confirmBattleResults);

  return {
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
  };
}
