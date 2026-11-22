import type { ReactNode } from "react";

import { Chip, ChipLabel } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

import { BADGE } from "./badge-style";
import type { RosterUnit } from "./unit-view";

/**
 * A card's top row of badges, every one the same chip (William, 12 Nov 2026: the row "is busy, with
 * different element sizes and styles crammed together"): the mount it rides, Missing and a
 * pact-sworn hired sword's Blood pact (while the campaign has them on), in the head or, a hero's,
 * opposite his trading action (UnitCard). Advance ready sits on the card's top edge, and a hero's
 * bounties show only on the overview (William: "dont need to see the bounty on the warband sheet
 * for a unit").
 */
export default function UnitBadges({
  entry,
  campaign,
  canEdit,
  onRide,
}: {
  entry: RosterUnit;
  campaign: CampaignSummary | null;
  canEdit: boolean;
  onRide: (rowId: number, on: boolean) => void;
}) {
  const { unit } = entry;
  return (
    <>
      {(unit.mounts ?? []).map((mount) => {
        const riding = unit.mount?.item_row_id === mount.item_row_id;
        return (
          <Chip
            key={mount.item_row_id}
            pressed={riding}
            disabled={!canEdit}
            className={BADGE}
            onClick={() => onRide(mount.item_row_id, !riding)}
          >
            {riding ? mount.name : "On foot"}
          </Chip>
        );
      })}
      {unit.missing_games ? (
        <ChipLabel tone="danger" className={BADGE}>
          Missing · {unit.missing_games} {unit.missing_games === 1 ? "game" : "games"}
        </ChipLabel>
      ) : null}
      {campaign?.enable_blood_pacts && entry.kind === "hireling" && entry.unit.blood_pacted ? (
        <ChipLabel tone="accent" className={BADGE}>
          Blood pact
        </ChipLabel>
      ) : null}
    </>
  );
}

/**
 * A hero's trading action, off the badge row and on a line of its own under the head (William, 12
 * Nov 2026: "trading actions are especially space-consuming"); `start` sits opposite it (his
 * badges and the open card's kills).
 */
export function UnitTradingAction({
  entry,
  canEdit,
  onTradingAction,
  start,
}: {
  entry: RosterUnit;
  canEdit: boolean;
  onTradingAction?: (on: boolean) => void;
  start?: ReactNode;
}) {
  if (entry.kind !== "hero") return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{start}</div>
      <Switch
        look="plain"
        className="min-h-[30px] text-xs"
        checked={Boolean(entry.unit.trading_action)}
        disabled={!canEdit || !onTradingAction}
        onCheckedChange={(on) => onTradingAction?.(on)}
      >
        Trading action
      </Switch>
    </div>
  );
}
