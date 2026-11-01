import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ChipLabel } from "@/components/ui/chip";

import { warbandStashQuery } from "../../api/economy-queries";
import { useGroupLoadout, type ShareChoice } from "../../hooks/units/useGroupLoadout";
import { gapLine, memberGaps, memberShare, sitsOut, type MemberGap } from "../../units/loadout";
import type { Henchman, HenchmenGroup } from "../../types/warband-types";
import { liveMembers, memberName } from "./unit-view";

type GroupMembersProps = {
  group: HenchmenGroup;
  campaignId: number;
  warbandId: number;
  canEdit: boolean;
};

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/**
 * An open group's members (henchmen loadouts): each with the loadout rows he lacks (Buy one, Take
 * from stash, Leave it), Take his kit to the stash, and Dismiss, which asks where his share goes.
 */
export default function GroupMembers({ group, campaignId, warbandId, canEdit }: GroupMembersProps) {
  const loadout = useGroupLoadout(campaignId, warbandId);
  const stash = useQuery({ ...warbandStashQuery(campaignId, warbandId), enabled: canEdit });
  const [asking, setAsking] = useState<number | null>(null);
  const inStash = (itemId: number) => stash.data?.find((item) => item.id === itemId)?.quantity ?? 0;

  const gapActions = (gap: MemberGap) => {
    const price = gap.row.current_price ?? gap.row.cost ?? 0;
    return (
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          disabled={loadout.busy}
          onClick={() => loadout.actOnGap(group, gap.id, { action: "buy", price })}
        >
          Buy one · {price} gc
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={loadout.busy || inStash(gap.row.id) === 0}
          onClick={() => loadout.actOnGap(group, gap.id, { action: "stash" })}
        >
          Take from stash
        </Button>
        {gap.left ? null : (
          <Button
            size="sm"
            variant="ghost"
            disabled={loadout.busy}
            onClick={() => loadout.actOnGap(group, gap.id, { action: "leave" })}
          >
            Leave it
          </Button>
        )}
      </div>
    );
  };

  const dismissAsk = (member: Henchman) => {
    const share = memberShare(group, member);
    const choose = (choice: ShareChoice) => {
      setAsking(null);
      loadout.dismiss(group, member, choice);
    };
    return (
      <div
        role="group"
        aria-label={`Dismiss ${memberName(group, member)}`}
        className="flex flex-col gap-1.5 bg-raised px-2.5 py-2 text-[13px]"
      >
        <span className="text-ink">
          {share.length
            ? `Dismiss ${memberName(group, member)}: his share (${share.map((item) => item.name).join(", ")}) to the stash, or he leaves with it?`
            : `Dismiss ${memberName(group, member)}? He carries nothing of the loadout.`}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {share.length ? (
            <Button size="sm" onClick={() => choose("stash")}>
              His share to the stash
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={share.length ? "secondary" : "primary"}
            onClick={() => choose("leaves")}
          >
            {share.length ? "He leaves with it" : "Dismiss him"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>Members</span>
      {liveMembers(group).map((member) => {
        const gaps = memberGaps(group, member);
        const out = sitsOut(group, member);
        return (
          <div key={member.id} className="flex flex-col gap-1.5 border-t border-line pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-ink">{memberName(group, member)}</span>
              {member.kills ? (
                <span className="text-xs text-muted-foreground">{member.kills} kills</span>
              ) : null}
              {out ? <ChipLabel tone="danger">Sits out the next battle</ChipLabel> : null}
              {canEdit ? (
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={loadout.busy || memberShare(group, member).length === 0}
                    onClick={() => loadout.takeKit(group, member)}
                  >
                    Take his kit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAsking(member.id)}>
                    Dismiss
                  </Button>
                </div>
              ) : null}
            </div>
            {asking === member.id ? dismissAsk(member) : null}
            {gaps.map((gap) => (
              <div
                key={gap.id}
                className="flex flex-col gap-1.5 border border-dashed border-danger-line px-2.5 py-2 text-[13px]"
              >
                <span className={gap.left ? "text-text2" : "text-danger"}>
                  {gap.left
                    ? `${member.name || "He"} goes without ${gap.row.name}.`
                    : gapLine(member, gap)}
                </span>
                {canEdit ? gapActions(gap) : null}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
