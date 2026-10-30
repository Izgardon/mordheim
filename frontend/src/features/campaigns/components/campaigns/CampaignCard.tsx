import { useId, useMemo, useState } from "react";

// routing
import { Link } from "react-router-dom";

// components
import { Button } from "@components/button";
import { Card } from "@components/card";
import { ChipLabel } from "@components/chip";

// types
import type { CampaignSummary } from "../../types/campaign-types";

// other
import CampaignPlayersDialog from "../dialogs/CampaignPlayersDialog";

/**
 * A campaign on the list. The title is the card's real link, stretched over the whole card, and
 * the Roster and Copy buttons sit above it, so no button is nested in a link (CAMP-UX-07).
 */
export default function CampaignCard({
  id,
  name,
  player_count,
  max_players,
  role,
  join_code,
  archived_at,
}: CampaignSummary) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);

  const roleLabel = useMemo(() => {
    if (!role) {
      return "Player";
    }
    return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  }, [role]);

  const handleCopyJoinCode = async () => {
    if (!join_code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(join_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card as="article" aria-labelledby={titleId} className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2
          id={titleId}
          className="min-w-0 break-words font-display text-xl font-semibold text-head"
        >
          <Link
            to={`/campaigns/${id}`}
            className="outline-none after:absolute after:inset-0 after:z-[1] after:content-[''] hover:text-accent-hi focus-visible:underline"
          >
            {name}
          </Link>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {archived_at ? <ChipLabel>Archived</ChipLabel> : null}
          <ChipLabel tone={role === "player" ? "default" : "accent"}>{roleLabel}</ChipLabel>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm text-text2">
        <span>
          {player_count} / {max_players} players
        </span>
        <div className="relative z-[2]">
          <CampaignPlayersDialog
            campaignId={id}
            open={isRosterOpen}
            onOpenChange={setIsRosterOpen}
          />
        </div>
      </div>
      {/* Every member sees the code; owners and admins regenerate it in Settings (1b). */}
      {join_code ? (
        <div className="flex items-center justify-between gap-3 text-sm text-text2">
          <span className="min-w-0">
            Join code: <span className="font-mono font-bold uppercase text-ink">{join_code}</span>
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="relative z-[2]"
            onClick={() => void handleCopyJoinCode()}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
