import { Fragment, useState } from "react";

import { RosterSkeleton } from "@components/card-skeleton";

import MemberActions from "./MemberActions";
import { MemberDesktopRow, MemberMobileRows } from "./MemberRows";
import PermissionGrantMenu from "./PermissionGrantMenu";
import { useMediaQuery } from "@/lib/use-media-query";

import type { CampaignMember, CampaignPermission } from "../../types/campaign-types";

type MembersCardProps = {
  isLoading: boolean;
  members: CampaignMember[];
  /** The codes the server offers, in its order (`GET permissions/`). */
  permissionOptions: CampaignPermission[];
  formatPermissionsLabel: (codes: string[]) => string;
  canManagePermissions: boolean;
  canManageRoles: boolean;
  /** Whether the viewer may remove this member (decision 1); omitted for none. */
  canRemoveMember?: (member: CampaignMember) => boolean;
  /** `capabilities.hand_over`: Make owner on the other members' rows (CAMP-NEW-02). */
  canHandOver?: boolean;
  savingPermissions: Record<number, boolean>;
  savingRoles: Record<number, boolean>;
  memberErrors: Record<number, string>;
  onTogglePermission: (memberId: number, code: string) => void;
  onToggleRole: (member: CampaignMember) => void;
  onRemoveRequest?: (member: CampaignMember) => void;
  onHandOverRequest?: (member: CampaignMember) => void;
};

const HEAD_CELL = "table-head-surface px-4 py-3 text-left font-semibold";

export default function MembersCard(props: MembersCardProps) {
  const { isLoading, members, canHandOver = false } = props;
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const isRemovable = (member: CampaignMember) => props.canRemoveMember?.(member) ?? false;
  const hasActions = (member: CampaignMember) =>
    isRemovable(member) || (canHandOver && member.role !== "owner");
  const hasActionsColumn = !isMobile && members.some(hasActions);

  const rowProps = (member: CampaignMember, index: number) => ({
    member,
    rowClassName:
      index % 2 === 0 ? "table-row-even table-row-hover" : "table-row-odd table-row-hover",
    canManageRoles: props.canManageRoles,
    isSavingRole: Boolean(props.savingRoles[member.id]),
    error: props.memberErrors[member.id],
    onToggleRole: props.onToggleRole,
    grantMenu: (className: string) => (
      <PermissionGrantMenu
        member={member}
        options={props.permissionOptions}
        label={
          member.role === "player"
            ? props.formatPermissionsLabel(member.permissions)
            : "All permissions"
        }
        canManagePermissions={props.canManagePermissions}
        isSaving={Boolean(props.savingPermissions[member.id])}
        onToggle={(code) => props.onTogglePermission(member.id, code)}
        className={className}
      />
    ),
    actions: hasActions(member) ? (
      <MemberActions
        member={member}
        canHandOver={canHandOver}
        canRemove={isRemovable(member)}
        onHandOverRequest={props.onHandOverRequest}
        onRemoveRequest={props.onRemoveRequest}
      />
    ) : null,
  });

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">Roster</h3>
      {isLoading ? (
        <RosterSkeleton rows={4} />
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No names logged yet.</p>
      ) : (
        <div className="table-shell overflow-hidden rounded-2xl">
          <div className="scrollbar-hidden-mobile max-h-[420px] overflow-x-auto overflow-y-auto">
            <table
              className={`w-full text-left text-sm text-foreground${isMobile ? "" : " min-w-[540px]"}`}
            >
              <thead className="sticky top-0 z-20">
                <tr className="table-head-surface border-b border-border/40 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  <th className={HEAD_CELL}>Name</th>
                  {!isMobile ? <th className={HEAD_CELL}>Email</th> : null}
                  {!isMobile ? <th className={HEAD_CELL}>Rank</th> : null}
                  {!isMobile ? <th className={HEAD_CELL}>Admin</th> : null}
                  {!isMobile ? <th className={HEAD_CELL}>Permissions</th> : null}
                  {isMobile ? <th className="table-head-surface w-10 px-2 py-3" /> : null}
                  {hasActionsColumn ? (
                    <th className="table-head-surface px-2 py-3 text-left font-semibold"></th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => (
                  <Fragment key={member.id}>
                    {isMobile ? (
                      <MemberMobileRows
                        {...rowProps(member, index)}
                        isExpanded={expandedMemberId === member.id}
                        onToggleExpanded={() =>
                          setExpandedMemberId((prev) => (prev === member.id ? null : member.id))
                        }
                      />
                    ) : (
                      <MemberDesktopRow
                        {...rowProps(member, index)}
                        hasActionsColumn={hasActionsColumn}
                      />
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
