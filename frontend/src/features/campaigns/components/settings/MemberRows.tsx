import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@components/badge";
import { Checkbox } from "@components/checkbox";

import { roleLabel, roleTone } from "../../constants/campaign-settings";

import type { CampaignMember } from "../../types/campaign-types";

export type MemberRowProps = {
  member: CampaignMember;
  rowClassName: string;
  canManageRoles: boolean;
  isSavingRole: boolean;
  error?: string;
  onToggleRole: (member: CampaignMember) => void;
  /** The grant menu, sized for the row. */
  grantMenu: (className: string) => ReactNode;
  /** Make owner and Remove from campaign, or null. */
  actions: ReactNode;
};

function AdminBox({ member, canManageRoles, isSavingRole, onToggleRole }: MemberRowProps) {
  return (
    <Checkbox
      checked={member.role === "admin"}
      disabled={!canManageRoles || isSavingRole}
      onChange={() => onToggleRole(member)}
    />
  );
}

/** A member on desktop: name, email, rank, Admin, grants and the actions column. */
export function MemberDesktopRow(props: MemberRowProps & { hasActionsColumn: boolean }) {
  const { member, rowClassName, error, grantMenu, actions, hasActionsColumn } = props;
  return (
    <tr className={`border-b border-border/40 transition-colors ${rowClassName}`}>
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
            <AdminBox {...props} />
            <span>Admin</span>
          </label>
        )}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground">
        {grantMenu("w-56")}
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </td>
      {hasActionsColumn ? <td className="px-2 py-3 align-top">{actions}</td> : null}
    </tr>
  );
}

/** A member on a phone: the name, unfolding to everything else. */
export function MemberMobileRows(
  props: MemberRowProps & { isExpanded: boolean; onToggleExpanded: () => void }
) {
  const { member, rowClassName, error, grantMenu, actions, isExpanded, onToggleExpanded } = props;
  return (
    <>
      <tr
        className={`cursor-pointer border-b border-border/40 transition-colors ${rowClassName}`}
        onClick={onToggleExpanded}
      >
        <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
        <td className="w-10 px-2 py-3 text-right">
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition${isExpanded ? " rotate-180" : ""}`}
            aria-hidden="true"
          />
        </td>
      </tr>
      {isExpanded ? (
        <tr className="table-row-active border-b border-border/40">
          <td colSpan={2} className="px-4 pb-4 pt-2">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{member.email}</p>
              <Badge variant="outline" className={roleTone[member.role]}>
                {roleLabel(member.role)}
              </Badge>
              {member.role !== "owner" ? (
                <label
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AdminBox {...props} />
                  <span>Admin</span>
                </label>
              ) : null}
              <div onClick={(e) => e.stopPropagation()}>
                {grantMenu("w-full max-w-[160px]")}
                {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
              </div>
              {actions ? <div onClick={(e) => e.stopPropagation()}>{actions}</div> : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
