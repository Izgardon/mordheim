import { Minus, Plus } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { formatFee } from "@/features/hirelings/fees";

import UnitSectionLabel from "./UnitSectionLabel";
import { xpInfo, type RosterUnit } from "./unit-view";
import XpTrack from "./XpTrack";

/**
 * An open card's experience, across its full width: the XP track with − and + (a point
 * each, which the server counts half at half rate), and a hired sword's upkeep. A waiting
 * advance is the card's Advance ready, on its top edge only (William, 7 Nov 2026: "remove advance
 * btn next to xp bar").
 */
export default function UnitXp({
  entry,
  campaign,
  canEdit,
  onXp,
}: {
  entry: RosterUnit;
  campaign: CampaignSummary | null;
  canEdit: boolean;
  /** XP added (negative: taken away). */
  onXp: (change: number) => void;
}) {
  const xp = xpInfo(entry, campaign);
  return (
    <div className="flex flex-col gap-2">
      <UnitSectionLabel icon="xp">Experience</UnitSectionLabel>
      {xp ? (
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <IconButton
              aria-label="One XP less"
              className="h-9 w-9"
              disabled={xp.xp <= 0}
              onClick={() => onXp(-1)}
            >
              <Minus aria-hidden="true" />
            </IconButton>
          ) : null}
          <div className="flex min-w-40 flex-1 flex-col gap-1">
            <XpTrack xp={xp.xp} thresholds={xp.thresholds} />
            <span className="font-mono text-xs text-muted-foreground">{xp.text}</span>
          </div>
          {canEdit ? (
            <IconButton aria-label="One XP more" className="h-9 w-9" onClick={() => onXp(1)}>
              <Plus aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">No XP</span>
      )}
      {entry.kind === "hireling" ? (
        <dl className="m-0 flex gap-3 text-[13px]">
          <dt className="text-faint">Upkeep</dt>
          <dd className="m-0 text-ink">{formatFee(entry.unit.upkeep_fee)}</dd>
        </dl>
      ) : null}
    </div>
  );
}
