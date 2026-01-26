import { useEffect, useMemo, useState } from "react";

// routing
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

// components
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";

// api
import {
  deleteCampaign,
  listCampaignMembers,
  updateMemberPermissions,
  updateMemberRole,
} from "../api/campaigns-api";

// types
import type { CampaignMember } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

const permissionOptions = [
  {
    code: "manage_skills",
    label: "Manage skills",
    description: "Create and curate skills for the campaign.",
  },
  {
    code: "manage_items",
    label: "Manage items",
    description: "Add and maintain wargear entries.",
  },
  {
    code: "manage_rules",
    label: "Manage house rules",
    description: "Draft and adjust campaign house rules.",
  },
  {
    code: "manage_warbands",
    label: "Manage warbands",
    description: "Oversee warband actions and rosters.",
  },
];

const roleTone: Record<CampaignMember["role"], string> = {
  owner: "bg-primary/15 text-primary border-primary/30",
  admin: "bg-accent/15 text-accent border-accent/30",
  player: "bg-secondary/40 text-foreground border-border/60",
};

const roleLabel = (role: CampaignMember["role"]) =>
  `${role.charAt(0).toUpperCase()}${role.slice(1)}`;

export default function CampaignSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
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

  const campaignId = Number(id);
  const isDeleteReady = deleteValue.trim().toLowerCase() === "delete";

  const permissionLabelMap = useMemo(
    () => new Map(permissionOptions.map((option) => [option.code, option.label])),
    []
  );

  useEffect(() => {
    if (!campaign || !["owner", "admin"].includes(campaign.role) || Number.isNaN(campaignId)) {
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
  }, [campaign, campaignId]);

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of that campaign.</p>;
  }

  if (!["owner", "admin"].includes(campaign.role)) {
    return (
      <p className="text-sm text-muted-foreground">
        Only campaign owners and admins can manage settings.
      </p>
    );
  }

  if (Number.isNaN(campaignId)) {
    return <p className="text-sm text-red-600">Invalid campaign id.</p>;
  }

  const canManagePermissions = campaign.role === "owner" || campaign.role === "admin";
  const canManageRoles = campaign.role === "owner";

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

  const handleDeleteCampaign = async () => {
    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteCampaign(campaignId);
      navigate("/campaigns");
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

  return (
    <div className="space-y-8">
      <SettingsHeader campaign={campaign} />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <MembersCard
        isLoading={isLoading}
        members={members}
        permissionOptions={permissionOptions}
        formatPermissionsLabel={formatPermissionsLabel}
        canManagePermissions={canManagePermissions}
        canManageRoles={canManageRoles}
        savingPermissions={savingPermissions}
        savingRoles={savingRoles}
        memberErrors={memberErrors}
        onTogglePermission={handlePermissionToggle}
        onToggleRole={handleRoleToggle}
      />

      {campaign.role === "owner" ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Delete campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog
              open={deleteOpen}
              onOpenChange={(open) => {
                setDeleteOpen(open);
                if (!open) {
                  setDeleteValue("");
                  setDeleteError("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="destructive">Close campaign</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm closure</DialogTitle>
                  <DialogDescription>
                    Type delete to burn this chronicle and all related data.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Type delete"
                    value={deleteValue}
                    onChange={(event) => setDeleteValue(event.target.value)}
                  />
                  {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
                </div>
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteCampaign}
                    disabled={!isDeleteReady || isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Erase campaign"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

type SettingsHeaderProps = {
  campaign: CampaignLayoutContext["campaign"];
};

function SettingsHeader({ campaign }: SettingsHeaderProps) {
  if (!campaign) {
    return null;
  }

  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
        Command
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">{campaign.name}</h1>
      <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm text-muted-foreground shadow-[0_12px_22px_rgba(5,20,24,0.25)]">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Rally code
        </span>
        <span className="font-mono text-foreground">{campaign.join_code}</span>
      </div>
    </header>
  );
}

type MembersCardProps = {
  isLoading: boolean;
  members: CampaignMember[];
  permissionOptions: typeof permissionOptions;
  formatPermissionsLabel: (codes: string[]) => string;
  canManagePermissions: boolean;
  canManageRoles: boolean;
  savingPermissions: Record<number, boolean>;
  savingRoles: Record<number, boolean>;
  memberErrors: Record<number, string>;
  onTogglePermission: (memberId: number, code: string) => void;
  onToggleRole: (member: CampaignMember) => void;
};

function MembersCard({
  isLoading,
  members,
  permissionOptions,
  formatPermissionsLabel,
  canManagePermissions,
  canManageRoles,
  savingPermissions,
  savingRoles,
  memberErrors,
  onTogglePermission,
  onToggleRole,
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
                    <td className="px-4 py-3 align-top">
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
                          <span aria-hidden="true">v</span>
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
