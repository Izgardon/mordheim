import { Badge } from "@components/badge";
import { Button } from "@components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { ChevronDown } from "lucide-react";

import { permissionOptions, roleLabel, roleTone } from "../../constants/campaign-settings";

import type { CampaignMember } from "../../types/campaign-types";

type MembersCardProps = {
  isLoading: boolean;
  members: CampaignMember[];
  formatPermissionsLabel: (codes: string[]) => string;
  canManagePermissions: boolean;
  canManageRoles: boolean;
  savingPermissions: Record<number, boolean>;
  savingRoles: Record<number, boolean>;
  memberErrors: Record<number, string>;
  onTogglePermission: (memberId: number, code: string) => void;
  onToggleRole: (member: CampaignMember) => void;
  onRemoveRequest: (member: CampaignMember) => void;
  canRemoveMembers: boolean;
};

export default function MembersCard({
  isLoading,
  members,
  formatPermissionsLabel,
  canManagePermissions,
  canManageRoles,
  savingPermissions,
  savingRoles,
  memberErrors,
  onTogglePermission,
  onToggleRole,
  onRemoveRequest,
  canRemoveMembers,
}: MembersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roster</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calling the roster...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No names logged yet.</p>
        ) : (
          <div className="overflow-visible rounded-2xl border border-border/60 bg-card/70 shadow-[0_12px_24px_rgba(5,20,24,0.3)]">
            <table className="min-w-full divide-y divide-border/70 text-sm">
              <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Rank</th>
                  <th className="px-4 py-3 text-left font-semibold">Admin</th>
                  <th className="px-4 py-3 text-left font-semibold">Permissions</th>
                  {canRemoveMembers ? (
                    <th className="w-10 px-2 py-3 text-left font-semibold"></th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="bg-transparent odd:bg-background/60 even:bg-card/60 hover:bg-accent/20"
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
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border text-foreground focus:ring-primary/60"
                            checked={member.role === "admin"}
                            disabled={!canManageRoles || Boolean(savingRoles[member.id])}
                            onChange={() => onToggleRole(member)}
                          />
                          <span>Admin</span>
                        </label>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      <details className="group relative inline-block">
                        <summary
                          className={[
                            "flex w-56 min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-1 text-xs",
                            member.role !== "player" || !canManagePermissions
                              ? "cursor-not-allowed opacity-70"
                              : "hover:border-primary/50",
                          ].join(" ")}
                        >
                          <span className="truncate">
                            {member.role === "player"
                              ? formatPermissionsLabel(member.permissions)
                              : "All permissions"}
                          </span>
                          <ChevronDown
                            className="h-3.5 w-3.5 text-muted-foreground transition group-open:rotate-180"
                            aria-hidden="true"
                          />
                        </summary>
                        <div className="absolute right-0 z-20 mt-2 w-72 space-y-2 rounded-2xl border border-border/60 bg-background p-3 shadow-[0_12px_22px_rgba(5,20,24,0.35)]">
                          {permissionOptions.map((option) => {
                            const isAutoGranted = member.role !== "player";
                            const isChecked =
                              isAutoGranted || member.permissions.includes(option.code);
                            return (
                              <label key={option.code} className="flex items-start gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  className="mt-1 h-3.5 w-3.5 rounded border-border text-foreground focus:ring-primary/60"
                                  checked={isChecked}
                                  disabled={
                                    isAutoGranted ||
                                    !canManagePermissions ||
                                    Boolean(savingPermissions[member.id])
                                  }
                                  onChange={() => onTogglePermission(member.id, option.code)}
                                />
                                <span>
                                  <span className="font-semibold text-foreground">
                                    {option.label}
                                  </span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {option.description}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </details>
                      {memberErrors[member.id] ? (
                        <p className="mt-2 text-xs text-red-600">{memberErrors[member.id]}</p>
                      ) : null}
                    </td>
                    {canRemoveMembers ? (
                      <td className="px-2 py-3 align-top">
                        {member.role === "player" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[0.55rem] text-red-200 hover:text-red-100"
                            onClick={() => onRemoveRequest(member)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

