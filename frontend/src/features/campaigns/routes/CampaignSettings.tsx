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
  listAdminPermissions,
  listCampaignMembers,
  updateAdminPermissions,
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
  owner: "bg-red-600/10 text-red-700 border-red-200",
  admin: "bg-amber-500/10 text-amber-700 border-amber-200",
  player: "bg-slate-500/10 text-foreground border-slate-200",
};

const roleLabel = (role: CampaignMember["role"]) =>
  `${role.charAt(0).toUpperCase()}${role.slice(1)}`;

export default function CampaignSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteValue, setDeleteValue] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const campaignId = Number(id);
  const isDeleteReady = deleteValue.trim().toLowerCase() === "delete";

  const adminPermissionsLabel = useMemo(() => {
    if (selectedPermissions.length === 0) {
      return "None";
    }
    const labelMap = new Map(permissionOptions.map((option) => [option.code, option.label]));
    return selectedPermissions.map((code) => labelMap.get(code) || code).join(", ");
  }, [selectedPermissions]);

  useEffect(() => {
    if (!campaign || campaign.role !== "owner" || Number.isNaN(campaignId)) {
      return;
    }

    setIsLoading(true);
    setError("");

    Promise.all([listCampaignMembers(campaignId), listAdminPermissions(campaignId)])
      .then(([membersData, permissionsData]) => {
        setMembers(membersData);
        setSelectedPermissions(permissionsData.map((permission) => permission.code));
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

  if (campaign.role !== "owner") {
    return <p className="text-sm text-muted-foreground">Only the campaign leader can manage settings.</p>;
  }

  if (Number.isNaN(campaignId)) {
    return <p className="text-sm text-red-600">Invalid campaign id.</p>;
  }

  const togglePermission = (code: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
    setSaveMessage("");
    setSaveError("");
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      const updated = await updateAdminPermissions(campaignId, selectedPermissions);
      setSelectedPermissions(updated.map((permission) => permission.code));
      setSaveMessage("Orders updated.");
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSaveError(errorResponse.message || "Unable to update orders");
      } else {
        setSaveError("Unable to update orders");
      }
    } finally {
      setIsSaving(false);
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
        adminPermissionsLabel={adminPermissionsLabel}
      />

      <Card>
        <CardHeader>
          <CardTitle>Command orders</CardTitle>
          <CardDescription>
            Owners can grant or revoke orders for every admin in the campaign.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {permissionOptions.map((option) => (
            <label
              key={option.code}
              className="flex items-start gap-3 rounded-lg border-2 border-border/70 bg-card/70 p-3 shadow-[2px_2px_0_rgba(23,16,8,0.15)]"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-foreground focus:ring-foreground"
                checked={selectedPermissions.includes(option.code)}
                onChange={() => togglePermission(option.code)}
              />
              <div>
                <p className="text-sm font-semibold text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSavePermissions} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save orders"}
          </Button>
          {saveMessage ? <span className="text-sm text-emerald-700">{saveMessage}</span> : null}
          {saveError ? <span className="text-sm text-red-600">{saveError}</span> : null}
        </div>
      </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Close campaign</CardTitle>
          <CardDescription>
            Once the gates close, the record is sealed. Type delete to erase {campaign.name}.
          </CardDescription>
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
      <div className="mt-4 inline-flex items-center gap-2 rounded-md border-2 border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground shadow-[2px_2px_0_rgba(23,16,8,0.2)]">
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
  adminPermissionsLabel: string;
};

function MembersCard({ isLoading, members, adminPermissionsLabel }: MembersCardProps) {
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
          <div className="overflow-hidden rounded-lg border-2 border-border/70 bg-card/70 shadow-[4px_4px_0_rgba(23,16,8,0.2)]">
            <table className="min-w-full divide-y divide-border/70 text-sm">
              <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Rank</th>
                  <th className="px-4 py-3 text-left font-semibold">Orders</th>
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
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.role === "owner"
                        ? "Full command"
                        : member.role === "admin"
                        ? adminPermissionsLabel
                        : "None"}
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




