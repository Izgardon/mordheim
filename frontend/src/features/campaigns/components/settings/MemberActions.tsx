import { Button } from "@components/button";
import { cn } from "@/lib/utils";

import { MAKE_ADMIN_FIRST } from "../../hooks/settings/useHandOver";

import type { CampaignMember } from "../../types/campaign-types";

type MemberActionsProps = {
  member: CampaignMember;
  /** `capabilities.hand_over` (the owner): Make owner on every other member's row. */
  canHandOver: boolean;
  canRemove: boolean;
  onHandOverRequest?: (member: CampaignMember) => void;
  onRemoveRequest?: (member: CampaignMember) => void;
};

/**
 * A member row's actions. Make owner works on an admin's row; on a player's it stays visible but
 * greyed out, saying to make them an admin first (guide, not gatekeeper).
 */
export default function MemberActions({
  member,
  canHandOver,
  canRemove,
  onHandOverRequest,
  onRemoveRequest,
}: MemberActionsProps) {
  const offersHandOver = canHandOver && member.role !== "owner";
  const isAdmin = member.role === "admin";
  if (!offersHandOver && !canRemove) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {offersHandOver ? (
        <Button
          variant="secondary"
          size="sm"
          className={cn("h-7 px-2 text-[0.55rem]", !isAdmin && "opacity-50 grayscale")}
          aria-disabled={isAdmin ? undefined : "true"}
          title={isAdmin ? undefined : MAKE_ADMIN_FIRST}
          onClick={() => onHandOverRequest?.(member)}
        >
          Make owner
        </Button>
      ) : null}
      {canRemove ? (
        <Button
          variant="destructive"
          size="sm"
          className="h-7 px-2 text-[0.55rem]"
          onClick={() => onRemoveRequest?.(member)}
        >
          Remove from campaign
        </Button>
      ) : null}
    </div>
  );
}
