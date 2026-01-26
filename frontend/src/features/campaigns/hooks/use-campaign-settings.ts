import { useEffect, useMemo, useState } from "react";

// api
import {
  deleteCampaign,
  listCampaignMembers,
  removeCampaignMember,
  updateMemberPermissions,
  updateMemberRole,
} from "../api/campaigns-api";

// constants
import { permissionOptions } from "../constants/campaign-settings";

// types
import type { CampaignMember } from "../types/campaign-types";

type UseCampaignSettingsParams = {
  campaignId: number;
  campaignRole?: CampaignMember["role"];
  onDeleted: () => void;
};

export function useCampaignSettings({
  campaignId,
  campaignRole,
  onDeleted,
}: UseCampaignSettingsParams) {
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
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
  const canRemoveMembers = campaignRole === "owner";
  const isDeleteReady = deleteValue.trim().toLowerCase() === "delete";

  const permissionLabelMap = useMemo(
    () => new Map(permissionOptions.map((option) => [option.code, option.label])),
    []
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
        prev.map((entry) =>
          entry.id === member.id ? { ...entry, role: updated.role } : entry
        )
      );
    } catch (errorResponse) {
      const message =
        errorResponse instanceof Error
          ? errorResponse.message || "Unable to update role"
          : "Unable to update role";
      setMemberErrors((prev) => ({ ...prev, [member.id]: message }));
      setMembers((prev) =>
        prev.map((entry) =>
          entry.id === member.id ? { ...entry, role: previousRole } : entry
        )
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

  return {
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
  };
}
