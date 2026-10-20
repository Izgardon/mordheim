import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import { updateMemberPermissions, updateMemberRole } from "../../api/campaigns-api";
import { updateCachedList, useCampaignMembers } from "../../api/campaign-queries";
import { usePermissionCatalogue } from "../useCampaignQuery";

// other
import { campaignCapabilities, canRemoveMember } from "../../capabilities";
import { apiErrorCode, getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

// types
import type { CampaignMember, CampaignSummary } from "../../types/campaign-types";

const NO_MEMBERS: CampaignMember[] = [];

type Flags = Record<number, boolean>;

/**
 * Settings' members list (`view_members`): the grant menu's codes from the server (BUG-15), and
 * grants and roles that change on the row at once and go back if the server refuses
 * (CAMP-TEST-25). Each answer is written into the cached members list.
 */
export function useMembers(campaign: CampaignSummary) {
  const campaignId = campaign.id;
  const capabilities = campaignCapabilities(campaign);
  const queryClient = useQueryClient();
  const membersQuery = useCampaignMembers(campaignId, { enabled: capabilities.view_members });
  const members = membersQuery.data ?? NO_MEMBERS;
  const [savingPermissions, setSavingPermissions] = useState<Flags>({});
  const [savingRoles, setSavingRoles] = useState<Flags>({});
  const [memberErrors, setMemberErrors] = useState<Record<number, string>>({});

  const catalogueQuery = usePermissionCatalogue(campaignId, {
    enabled: capabilities.grant_permissions,
  });
  const permissionCatalogue = useMemo(() => catalogueQuery.data ?? [], [catalogueQuery.data]);
  const permissionLabels = useMemo(
    () => new Map(permissionCatalogue.map((option) => [option.code, option.label])),
    [permissionCatalogue]
  );

  const formatPermissionsLabel = (codes: string[]) =>
    codes.length === 0
      ? "None"
      : codes.map((code) => permissionLabels.get(code) || code).join(", ");

  const patchMember = (memberId: number, patch: Partial<CampaignMember>) =>
    updateCachedList<CampaignMember>(queryClient, queryKeys.campaign.members(campaignId), (prev) =>
      prev.map((member) => (member.id === memberId ? { ...member, ...patch } : member))
    );
  const setFlag = (set: typeof setSavingRoles, memberId: number, value: boolean) =>
    set((prev) => ({ ...prev, [memberId]: value }));
  const setMemberError = (memberId: number, message: string) =>
    setMemberErrors((prev) => ({ ...prev, [memberId]: message }));

  const handlePermissionToggle = async (memberId: number, code: string) => {
    const target = members.find((member) => member.id === memberId);
    if (!capabilities.grant_permissions || !target || target.role !== "player") {
      return;
    }
    const previous = target.permissions;
    const next = previous.includes(code)
      ? previous.filter((item) => item !== code)
      : [...previous, code];
    patchMember(memberId, { permissions: next });
    setMemberError(memberId, "");
    setFlag(setSavingPermissions, memberId, true);
    try {
      const updated = await updateMemberPermissions(campaignId, memberId, next);
      patchMember(memberId, { permissions: updated.map((permission) => permission.code) });
    } catch (errorResponse) {
      setMemberError(memberId, getErrorMessage(errorResponse, "Unable to update permissions"));
      patchMember(memberId, { permissions: previous });
      if (apiErrorCode(errorResponse) === "unknown_permission") {
        // The menu offered a code the server no longer has: read the codes again.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.campaign.permissionCatalogue(campaignId),
        });
      }
    } finally {
      setFlag(setSavingPermissions, memberId, false);
    }
  };

  const handleRoleToggle = async (member: CampaignMember) => {
    if (!capabilities.change_roles || member.role === "owner") {
      return;
    }
    const previousRole = member.role;
    const nextRole = member.role === "admin" ? "player" : "admin";
    patchMember(member.id, { role: nextRole });
    setMemberError(member.id, "");
    setFlag(setSavingRoles, member.id, true);
    try {
      const updated = await updateMemberRole(campaignId, member.id, nextRole);
      patchMember(member.id, { role: updated.role });
    } catch (errorResponse) {
      setMemberError(member.id, getErrorMessage(errorResponse, "Unable to update role"));
      patchMember(member.id, { role: previousRole });
    } finally {
      setFlag(setSavingRoles, member.id, false);
    }
  };

  return {
    members,
    isLoading: membersQuery.isPending,
    error: membersQuery.error ? getErrorMessage(membersQuery.error, "Unable to load settings") : "",
    permissionCatalogue,
    formatPermissionsLabel,
    canManagePermissions: capabilities.grant_permissions,
    canManageRoles: capabilities.change_roles,
    canRemoveMember: (member: CampaignMember) => canRemoveMember(campaign, member),
    savingPermissions,
    savingRoles,
    memberErrors,
    handlePermissionToggle,
    handleRoleToggle,
  };
}
