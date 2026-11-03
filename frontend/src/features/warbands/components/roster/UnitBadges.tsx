import { Chip, ChipLabel } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

import UnitKills from "./UnitKills";
import { xpInfo, type RosterUnit } from "./unit-view";

const ADVANCE =
  "inline-flex min-h-[30px] items-center border border-accent-line bg-accent-soft px-2.5 text-xs font-bold text-accent-hi";

/**
 * A card's top row of badges: the mount it rides, Missing, Advance ready (a button that starts
 * the advance), the kill count with its breakdown and a hero's trading action as a thin toggle.
 * A hero's bounties show only on the overview (William: "dont need to see the bounty on the
 * warband sheet for a unit").
 */
export default function UnitBadges({
  entry,
  campaign,
  warbandId,
  open,
  canEdit,
  onRide,
  onAdvance,
  onTradingAction,
}: {
  entry: RosterUnit;
  campaign: CampaignSummary | null;
  warbandId: number;
  open: boolean;
  canEdit: boolean;
  onRide: (rowId: number, on: boolean) => void;
  onAdvance?: () => void;
  onTradingAction?: (on: boolean) => void;
}) {
  const { unit } = entry;
  const xp = xpInfo(entry, campaign);
  return (
    <>
      {(unit.mounts ?? []).map((mount) => {
        const riding = unit.mount?.item_row_id === mount.item_row_id;
        return (
          <Chip
            key={mount.item_row_id}
            pressed={riding}
            disabled={!canEdit}
            className="min-h-[30px] px-2.5 text-xs font-bold"
            onClick={() => onRide(mount.item_row_id, !riding)}
          >
            {riding ? mount.name : "On foot"}
          </Chip>
        );
      })}
      {unit.missing_games ? (
        <ChipLabel tone="danger">
          Missing · {unit.missing_games} {unit.missing_games === 1 ? "game" : "games"}
        </ChipLabel>
      ) : null}
      {xp?.advanceReady && !open ? (
        canEdit && onAdvance ? (
          <button type="button" className={`${ADVANCE} hover:bg-raised`} onClick={onAdvance}>
            Advance ready
          </button>
        ) : (
          <ChipLabel tone="accent">Advance ready</ChipLabel>
        )
      ) : null}
      <UnitKills campaignId={campaign?.id ?? 0} warbandId={warbandId} entry={entry} />
      {entry.kind === "hero" ? (
        <Switch
          look="plain"
          className="min-h-[30px] text-xs"
          checked={Boolean(entry.unit.trading_action)}
          disabled={!canEdit || !onTradingAction}
          onCheckedChange={(on) => onTradingAction?.(on)}
        >
          Trading action
        </Switch>
      ) : null}
    </>
  );
}
