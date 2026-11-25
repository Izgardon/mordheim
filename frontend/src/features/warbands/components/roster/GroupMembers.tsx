import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ChipLabel } from "@/components/ui/chip";

import { warbandStashQuery } from "../../api/economy-queries";
import { useGroupLoadout } from "../../hooks/units/useGroupLoadout";
import { gapLine, memberGaps, memberShare, sitsOut, type MemberGap } from "../../units/loadout";
import { isMissing, missingGamesOf, missingLabel } from "../../units/missing-games";
import { isCreatureGroup } from "../../utils/companions";
import type { HenchmenGroup } from "../../types/warband-types";
import UnitKills from "./UnitKills";
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
 * from stash, Leave it), Take their kit to the stash, Missing while he misses games, and a
 * creature's Send back to stash (William, 25 Nov 2026; dismissing a member is the edit form's).
 */
export default function GroupMembers({ group, campaignId, warbandId, canEdit }: GroupMembersProps) {
  const loadout = useGroupLoadout(warbandId);
  const stash = useQuery({ ...warbandStashQuery(campaignId, warbandId), enabled: canEdit });
  const creature = isCreatureGroup(group);
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
              {/* the group's kills live here, a member's own count opening their own kills */}
              <UnitKills
                campaignId={campaignId}
                warbandId={warbandId}
                entry={{ kind: "henchmen_group", unit: group }}
                align="start"
                member={{ name: memberName(group, member), kills: member.kills ?? 0 }}
              />
              {isMissing(member) ? (
                <ChipLabel tone="danger" title={member.missing_reason || undefined}>
                  {missingLabel(missingGamesOf(member))}
                </ChipLabel>
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
                    Take their kit
                  </Button>
                  {creature ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={loadout.busy}
                      onClick={() => loadout.backToItem(group, member)}
                    >
                      Send back to stash
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {gaps.map((gap) => (
              <div
                key={gap.id}
                className="flex flex-col gap-1.5 border border-dashed border-danger-line px-2.5 py-2 text-[13px]"
              >
                <span className={gap.left ? "text-text2" : "text-danger"}>
                  {gap.left
                    ? `${member.name || "This member"} goes without ${gap.row.name}.`
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
