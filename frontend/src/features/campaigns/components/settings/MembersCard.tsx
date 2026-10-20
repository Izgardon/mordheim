import { Fragment, useState } from "react";

import { Badge } from "@components/badge";
import { Button } from "@components/button";
import { RosterSkeleton } from "@components/card-skeleton";
import { Checkbox } from "@components/checkbox";
import { ChevronDown } from "lucide-react";

import { roleLabel, roleTone } from "../../constants/campaign-settings";
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
  canRemoveMembers?: boolean;
  savingPermissions: Record<number, boolean>;
  savingRoles: Record<number, boolean>;
  memberErrors: Record<number, string>;
  onTogglePermission: (memberId: number, code: string) => void;
  onToggleRole: (member: CampaignMember) => void;
  onRemoveRequest?: (member: CampaignMember) => void;
  canKickPlayers?: boolean;
  onKickRequest?: (member: CampaignMember) => void;
};

export default function MembersCard({
  isLoading,
  members,
  permissionOptions,
  formatPermissionsLabel,
  canManagePermissions,
  canManageRoles,
  canRemoveMembers,
  savingPermissions,
  savingRoles,
  memberErrors,
  onTogglePermission,
  onToggleRole,
  onRemoveRequest,
  canKickPlayers,
  onKickRequest,
}: MembersCardProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);

  const grantMenu = (member: CampaignMember, className: string) => (
    <PermissionGrantMenu
      member={member}
      options={permissionOptions}
      label={
        member.role === "player" ? formatPermissionsLabel(member.permissions) : "All permissions"
      }
      canManagePermissions={canManagePermissions}
      isSaving={Boolean(savingPermissions[member.id])}
      onToggle={(code) => onTogglePermission(member.id, code)}
      className={className}
    />
  );

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
                  <th className="table-head-surface px-4 py-3 text-left font-semibold">Name</th>
                  {!isMobile ? (
                    <th className="table-head-surface px-4 py-3 text-left font-semibold">Email</th>
                  ) : null}
                  {!isMobile ? (
                    <th className="table-head-surface px-4 py-3 text-left font-semibold">Rank</th>
                  ) : null}
                  {!isMobile ? (
                    <th className="table-head-surface px-4 py-3 text-left font-semibold">Admin</th>
                  ) : null}
                  {!isMobile ? (
                    <th className="table-head-surface px-4 py-3 text-left font-semibold">
                      Permissions
                    </th>
                  ) : null}
                  {isMobile ? <th className="table-head-surface w-10 px-2 py-3" /> : null}
                  {(canKickPlayers || canRemoveMembers) && !isMobile ? (
                    <th className="table-head-surface px-2 py-3 text-left font-semibold"></th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => {
                  const rowClassName =
                    index % 2 === 0
                      ? "table-row-even table-row-hover"
                      : "table-row-odd table-row-hover";

                  return (
                    <Fragment key={member.id}>
                      {isMobile ? (
                        <>
                          <tr
                            className={`cursor-pointer border-b border-border/40 transition-colors ${rowClassName}`}
                            onClick={() =>
                              setExpandedMemberId((prev) => (prev === member.id ? null : member.id))
                            }
                          >
                            <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
                            <td className="w-10 px-2 py-3 text-right">
                              <ChevronDown
                                className={`h-3.5 w-3.5 text-muted-foreground transition${expandedMemberId === member.id ? " rotate-180" : ""}`}
                                aria-hidden="true"
                              />
                            </td>
                          </tr>
                          {expandedMemberId === member.id && (
                            <tr className="table-row-active border-b border-border/40">
                              <td colSpan={2} className="px-4 pb-4 pt-2">
                                <div className="space-y-3">
                                  <p className="text-xs text-muted-foreground">{member.email}</p>
                                  <Badge variant="outline" className={roleTone[member.role]}>
                                    {roleLabel(member.role)}
                                  </Badge>
                                  {member.role !== "owner" && (
                                    <label
                                      className="flex items-center gap-2 text-xs text-muted-foreground"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Checkbox
                                        checked={member.role === "admin"}
                                        disabled={
                                          !canManageRoles || Boolean(savingRoles[member.id])
                                        }
                                        onChange={() => onToggleRole(member)}
                                      />
                                      <span>Admin</span>
                                    </label>
                                  )}
                                  <div onClick={(e) => e.stopPropagation()}>
                                    {grantMenu(member, "w-full max-w-[160px]")}
                                    {memberErrors[member.id] ? (
                                      <p className="mt-2 text-xs text-red-600">
                                        {memberErrors[member.id]}
                                      </p>
                                    ) : null}
                                  </div>
                                  {canRemoveMembers && member.role === "player" ? (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex flex-wrap gap-2"
                                    >
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        className="h-7 px-2 text-[0.55rem]"
                                        onClick={() => onRemoveRequest?.(member)}
                                      >
                                        Remove
                                      </Button>
                                      {canKickPlayers && member.warband_id ? (
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="h-7 px-2 text-[0.55rem]"
                                          onClick={() => onKickRequest?.(member)}
                                        >
                                          Kick
                                        </Button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ) : (
                        <tr
                          className={`border-b border-border/40 transition-colors ${rowClassName}`}
                        >
                          <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={roleTone[member.role]}>
                              {roleLabel(member.role)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {member.role === "owner" ? (
                              <span className="text-xs text-muted-foreground">Owner</span>
                            ) : (
                              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                <Checkbox
                                  checked={member.role === "admin"}
                                  disabled={!canManageRoles || Boolean(savingRoles[member.id])}
                                  onChange={() => onToggleRole(member)}
                                />
                                <span>Admin</span>
                              </label>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-muted-foreground">
                            {grantMenu(member, "w-56")}
                            {memberErrors[member.id] ? (
                              <p className="mt-2 text-xs text-red-600">{memberErrors[member.id]}</p>
                            ) : null}
                          </td>
                          {canKickPlayers || canRemoveMembers ? (
                            <td className="px-2 py-3 align-top">
                              {member.role === "player" ? (
                                <div className="flex flex-wrap gap-2">
                                  {canRemoveMembers ? (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-7 px-2 text-[0.55rem]"
                                      onClick={() => onRemoveRequest?.(member)}
                                    >
                                      Remove
                                    </Button>
                                  ) : null}
                                  {canKickPlayers && member.warband_id ? (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-7 px-2 text-[0.55rem]"
                                      onClick={() => onKickRequest?.(member)}
                                    >
                                      Kick
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
