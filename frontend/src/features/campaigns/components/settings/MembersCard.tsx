import { Fragment, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import { Badge } from "@components/badge";
import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { RosterSkeleton } from "@components/card-skeleton";
import { Checkbox } from "@components/checkbox";
import { ChevronDown } from "lucide-react";

import { permissionOptions, roleLabel, roleTone } from "../../constants/campaign-settings";

import { useMediaQuery } from "@/lib/use-media-query";

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
  canKickPlayers?: boolean;
  onKickRequest?: (member: CampaignMember) => void;
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
  canKickPlayers,
  onKickRequest,
}: MembersCardProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [openMemberId, setOpenMemberId] = useState<number | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const triggerRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  function handleTriggerClick(e: React.MouseEvent, memberId: number) {
    e.stopPropagation();
    if (openMemberId === memberId) {
      setOpenMemberId(null);
      return;
    }
    const trigger = triggerRefs.current[memberId];
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const dropdownWidth = 288; // w-72
      const left = Math.min(
        rect.left,
        window.innerWidth - dropdownWidth - 8
      );
      setDropdownPos({ top: rect.bottom + 8, left: Math.max(8, left) });
    }
    setOpenMemberId(memberId);
  }

  useEffect(() => {
    if (openMemberId === null) return;
    function handleOutsideClick() {
      setOpenMemberId(null);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMemberId]);

  const openMember = members.find((m) => m.id === openMemberId) ?? null;

  return (
    <CardBackground disableBackground={isMobile} className={isMobile ? "space-y-4 p-3" : "space-y-4 p-6"}>
      <h3 className="text-lg font-semibold text-foreground">Roster</h3>
        {isLoading ? (
          <RosterSkeleton rows={4} />
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No names logged yet.</p>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card/70 shadow-[0_12px_24px_rgba(5,20,24,0.3)]">
            <table className={`w-full divide-y divide-border/70 text-sm${isMobile ? "" : " min-w-[540px]"}`}>
              <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  {!isMobile && <th className="px-4 py-3 text-left font-semibold">Email</th>}
                  {!isMobile && <th className="px-4 py-3 text-left font-semibold">Rank</th>}
                  {!isMobile && <th className="px-4 py-3 text-left font-semibold">Admin</th>}
                  {!isMobile && <th className="px-4 py-3 text-left font-semibold">Permissions</th>}
                  {isMobile && <th className="w-10 px-2 py-3" />}
                  {canKickPlayers && !isMobile ? (
                    <th className="w-10 px-2 py-3 text-left font-semibold"></th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {members.map((member) => (
                  <Fragment key={member.id}>
                    {isMobile ? (
                      <>
                        <tr
                          className="cursor-pointer bg-transparent hover:bg-accent/20"
                          onClick={() => setExpandedMemberId(prev => prev === member.id ? null : member.id)}
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
                          <tr className="bg-accent/10">
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
                                      disabled={!canManageRoles || Boolean(savingRoles[member.id])}
                                      onChange={() => onToggleRole(member)}
                                    />
                                    <span>Admin</span>
                                  </label>
                                )}
                                <div onClick={(e) => e.stopPropagation()}>
                                  <button
                                    ref={(el) => { triggerRefs.current[member.id] = el; }}
                                    type="button"
                                    onClick={(e) => handleTriggerClick(e, member.id)}
                                    disabled={member.role !== "player" || !canManagePermissions}
                                    className={[
                                      "flex min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-1 text-xs",
                                      "w-full max-w-[160px]",
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
                                      className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition${openMemberId === member.id ? " rotate-180" : ""}`}
                                      aria-hidden="true"
                                    />
                                  </button>
                                  {memberErrors[member.id] ? (
                                    <p className="mt-2 text-xs text-red-600">{memberErrors[member.id]}</p>
                                  ) : null}
                                </div>
                                {canKickPlayers && member.role === "player" && member.warband_id ? (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-7 px-2 text-[0.55rem]"
                                      onClick={() => onKickRequest?.(member)}
                                    >
                                      Kick
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ) : (
                      <tr className="bg-transparent hover:bg-accent/20">
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
                          <button
                            ref={(el) => { triggerRefs.current[member.id] = el; }}
                            type="button"
                            onClick={(e) => handleTriggerClick(e, member.id)}
                            disabled={member.role !== "player" || !canManagePermissions}
                            className={[
                              "flex min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-1 text-xs w-56",
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
                              className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition${openMemberId === member.id ? " rotate-180" : ""}`}
                              aria-hidden="true"
                            />
                          </button>
                          {memberErrors[member.id] ? (
                            <p className="mt-2 text-xs text-red-600">{memberErrors[member.id]}</p>
                          ) : null}
                        </td>
                        {canKickPlayers ? (
                          <td className="px-2 py-3 align-top">
                            {member.role === "player" && member.warband_id ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 px-2 text-[0.55rem]"
                                onClick={() => onKickRequest?.(member)}
                              >
                                Kick
                              </Button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {openMember !== null &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              zIndex: 9999,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-72 space-y-2 rounded-2xl border border-border/60 bg-background p-3 shadow-[0_12px_22px_rgba(5,20,24,0.35)]"
          >
            {permissionOptions.map((option) => {
              const isAutoGranted = openMember.role !== "player";
              const isChecked = isAutoGranted || openMember.permissions.includes(option.code);
              return (
                <label key={option.code} className="flex items-start gap-2 text-xs">
                  <Checkbox
                    className="mt-1"
                    checked={isChecked}
                    disabled={
                      isAutoGranted ||
                      !canManagePermissions ||
                      Boolean(savingPermissions[openMember.id])
                    }
                    onChange={() => onTogglePermission(openMember.id, option.code)}
                  />
                  <span>
                    <span className="font-semibold text-foreground">{option.label}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>,
          document.body
        )}
    </CardBackground>
  );
}
