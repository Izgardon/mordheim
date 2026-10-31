import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

import { getMemberRemovalPreview } from "../../api/campaigns-api";
import { campaignCapabilities } from "../../capabilities";
import { MAKE_ADMIN_FIRST, useHandOver } from "../../hooks/settings/useHandOver";
import { useMemberRemoval } from "../../hooks/settings/useMemberRemoval";
import { useMembers } from "../../hooks/settings/useMembers";
import type { CampaignMember, CampaignSummary } from "../../types/campaign-types";
import PermissionGrantMenu from "./PermissionGrantMenu";
import RemovalPreview, { memberVoice } from "./RemovalPreview";
import { FormError, SettingsCard, Tag } from "./settings-ui";
import { SettingsRowsLoading } from "./SettingsSkeleton";

const ROLE_LABEL: Record<CampaignMember["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  player: "Player",
};

/**
 * Remove from campaign (decision 1, BUG-12, BUG-50): what closes, read from the server first, that
 * the warband is kept, and how to keep the player out.
 */
function RemoveMemberDialog({
  campaignId,
  removal,
}: {
  campaignId: number;
  removal: ReturnType<typeof useMemberRemoval>;
}) {
  const target = removal.removeTarget;
  const preview = useQuery({
    queryKey: queryKeys.campaign.memberRemoval(campaignId, target?.id ?? 0),
    queryFn: () => getMemberRemovalPreview(campaignId, target!.id),
    enabled: removal.removeOpen && Boolean(target),
    staleTime: 0,
  });
  const name = target?.name || "this player";
  return (
    <ConfirmDialog
      open={removal.removeOpen}
      onOpenChange={(open) => !open && removal.closeRemoveDialog()}
      title="Remove from campaign"
      description={
        <div className="flex flex-col gap-3">
          <p className="m-0 text-ink">
            Remove <span className="font-bold">{name}</span> from the campaign?
          </p>
          {preview.isPending ? (
            <p className="m-0">Checking what this closes…</p>
          ) : preview.isError ? (
            <p className="m-0 text-danger">
              {getErrorMessage(preview.error, "Couldn't check what this closes.")} Their open
              battles and trades still close, and their warband is kept.
            </p>
          ) : (
            <RemovalPreview
              preview={preview.data}
              voice={memberVoice(name, target?.name || "This player")}
            />
          )}
          <p className="m-0 text-xs">
            They can rejoin with the join code. To keep them out, make a new join code afterwards.
          </p>
        </div>
      }
      error={removal.removeError}
      confirmText={removal.isRemoving ? "Removing…" : "Remove from campaign"}
      confirmDisabled={!target || preview.isPending}
      isConfirming={removal.isRemoving}
      onConfirm={() => void removal.handleRemoveMember()}
    />
  );
}

type MemberRowProps = {
  member: CampaignMember;
  members: ReturnType<typeof useMembers>;
  canHandOver: boolean;
  onRemove: (member: CampaignMember) => void;
  onHandOver: (member: CampaignMember) => void;
};

/** A member: name and email, role, Admin, the grants, Make owner and Remove. */
function MemberRow({ member, members, canHandOver, onRemove, onHandOver }: MemberRowProps) {
  const isOwner = member.role === "owner";
  const offersHandOver = canHandOver && !isOwner;
  const canRemove = members.canRemoveMember(member);
  const grantLabel =
    member.role === "player"
      ? members.formatPermissionsLabel(member.permissions)
      : "All permissions";
  return (
    <li className="flex flex-col gap-2 border-t border-line px-4 py-3.5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-head">{member.name}</span>
            <Tag tone={isOwner ? "accent" : undefined}>{ROLE_LABEL[member.role]}</Tag>
          </span>
          <span className="break-all text-xs text-muted-foreground">{member.email}</span>
          {member.warband_name ? (
            <span className="text-xs text-text2">{member.warband_name}</span>
          ) : null}
        </div>
        {isOwner ? null : (
          <Switch
            checked={member.role === "admin"}
            disabled={!members.canManageRoles || Boolean(members.savingRoles[member.id])}
            onCheckedChange={() => void members.handleRoleToggle(member)}
          >
            Admin
          </Switch>
        )}
        <PermissionGrantMenu
          member={member}
          options={members.permissionCatalogue}
          label={grantLabel}
          canManagePermissions={members.canManagePermissions}
          isSaving={Boolean(members.savingPermissions[member.id])}
          onToggle={(code) => void members.handlePermissionToggle(member.id, code)}
        />
        {offersHandOver || canRemove ? (
          <div className="flex flex-wrap gap-2">
            {offersHandOver ? (
              <Button
                size="sm"
                variant="secondary"
                // A player's row says to make them an admin first (guide, not gatekeeper).
                className={cn(member.role !== "admin" && "opacity-60")}
                title={member.role === "admin" ? undefined : MAKE_ADMIN_FIRST}
                onClick={() => onHandOver(member)}
              >
                Make owner
              </Button>
            ) : null}
            {canRemove ? (
              <Button size="sm" variant="danger" onClick={() => onRemove(member)}>
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <FormError message={members.memberErrors[member.id]} />
    </li>
  );
}

/**
 * Settings → Players (`view_members`): every member with their role, Admin (`change_roles`), the
 * grants (`grant_permissions`), Make owner (`hand_over`) and Remove from campaign, which shows what
 * the removal closes before it is confirmed.
 */
export default function PlayersSection({ campaign }: { campaign: CampaignSummary }) {
  const members = useMembers(campaign);
  const removal = useMemberRemoval(campaign.id);
  const handOver = useHandOver(campaign);
  const canHandOver = campaignCapabilities(campaign).hand_over;

  return (
    <SettingsCard
      title="Players"
      description={`${members.members.length || campaign.player_count} of ${campaign.max_players} places taken. Owners and admins hold every permission; a player holds only what is ticked.`}
    >
      <FormError message={members.error} />
      {members.isLoading ? (
        <SettingsRowsLoading label="Loading the members" rows={4} />
      ) : (
        <ul className="-mx-5 my-0 list-none border-y border-line p-0 max-[960px]:-mx-4">
          {members.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              members={members}
              canHandOver={canHandOver}
              onRemove={removal.requestRemoveMember}
              onHandOver={handOver.requestHandOver}
            />
          ))}
        </ul>
      )}
      <RemoveMemberDialog campaignId={campaign.id} removal={removal} />
      <ConfirmDialog
        open={Boolean(handOver.target)}
        onOpenChange={(open) => !open && handOver.closeHandOver()}
        title="Hand over the campaign"
        description={
          <div className="flex flex-col gap-2">
            <p className="m-0 text-ink">{`Make ${handOver.target?.name ?? "them"} the owner of ${campaign.name}?`}</p>
            <p className="m-0">
              You become an admin. Only the owner changes roles, archives the campaign or hands it
              on, so to have it back, ask them to hand it back.
            </p>
          </div>
        }
        error={handOver.error}
        confirmText={handOver.isHandingOver ? "Handing over…" : "Make owner"}
        confirmVariant="primary"
        isConfirming={handOver.isHandingOver}
        onConfirm={() => void handOver.confirmHandOver()}
      />
    </SettingsCard>
  );
}
