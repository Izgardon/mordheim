import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { formatFee } from "@/features/hirelings/fees";

import UnitSectionLabel from "./UnitSectionLabel";
import { xpInfo, type RosterUnit } from "./unit-view";

/**
 * An open card's experience column: the bar against the next advance with − and +, Advance
 * when one waits, and a hired sword's upkeep.
 */
export default function UnitXp({
  entry,
  campaign,
  canEdit,
  onXp,
  onAdvance,
}: {
  entry: RosterUnit;
  campaign: CampaignSummary | null;
  canEdit: boolean;
  onXp: (xp: number) => void;
  onAdvance?: () => void;
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
              onClick={() => onXp(Math.max(0, xp.xp - 1))}
            >
              <Minus aria-hidden="true" />
            </IconButton>
          ) : null}
          <div className="flex min-w-24 flex-1 flex-col gap-1">
            <div className="h-1.5 bg-line" aria-hidden="true">
              <div className="h-1.5 bg-primary" style={{ width: `${xp.share * 100}%` }} />
            </div>
            <span className="font-mono text-xs text-muted-foreground">{xp.text}</span>
          </div>
          {canEdit ? (
            <IconButton
              aria-label="One XP more"
              className="h-9 w-9"
              onClick={() => onXp(xp.xp + 1)}
            >
              <Plus aria-hidden="true" />
            </IconButton>
          ) : null}
          {xp.advanceReady && canEdit && onAdvance ? (
            <Button size="sm" onClick={onAdvance}>
              Advance
            </Button>
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
