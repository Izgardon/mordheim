import { useId, useState } from "react";

// routing
import { Link } from "react-router-dom";

// components
import { Button } from "@components/button";
import { Card } from "@components/card";
import { ChipLabel } from "@components/chip";
import { cn } from "@/lib/utils";

// types
import type { CampaignSummary } from "../../types/campaign-types";

// other
import CampaignPlayersDialog from "../dialogs/CampaignPlayersDialog";

const CAPTION = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/** Where the campaign stands: archived, under way (started), or not started yet. */
function campaignState({ archived_at, in_progress }: CampaignSummary) {
  if (archived_at) return { label: "Archived", tone: "default" } as const;
  return in_progress
    ? ({ label: "Under way", tone: "good" } as const)
    : ({ label: "Not started", tone: "default" } as const);
}

/**
 * A campaign on the list (design E): your role and its state, its name (the card's real link,
 * stretched over the whole card), your warband in it, then the players, the join code with Copy
 * and the roster. Copy and Roster sit above the stretched link, so no button is nested in a link
 * (CAMP-UX-07).
 */
export default function CampaignCard(campaign: CampaignSummary) {
  const { id, name, player_count, max_players, role, join_code, archived_at, my_warband } =
    campaign;
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const roleLabel = role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}` : "Player";
  const state = campaignState(campaign);

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
    <Card
      as="article"
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col transition-colors hover:border-accent-line",
        archived_at && "bg-transparent"
      )}
    >
      <div className="flex flex-col gap-2.5 p-5 max-[960px]:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <ChipLabel tone={role === "player" || !role ? "default" : "accent"}>
            {roleLabel}
          </ChipLabel>
          <ChipLabel tone={state.tone}>{state.label}</ChipLabel>
        </div>
        <h3
          id={titleId}
          className="m-0 break-words font-display text-2xl font-semibold leading-tight text-head max-[960px]:text-[22px]"
        >
          <Link
            to={`/campaigns/${id}`}
            className="outline-none after:absolute after:inset-0 after:z-[1] after:content-[''] hover:text-accent-hi focus-visible:underline"
          >
            {name}
          </Link>
        </h3>
        <p className="m-0 min-w-0 text-sm text-text2">
          {my_warband ? (
            <>
              <span className="font-semibold text-ink">{my_warband.name}</span>
              {my_warband.faction ? ` · ${my_warband.faction}` : null}
            </>
          ) : (
            <span className="text-faint">No warband raised yet</span>
          )}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line px-5 py-3 max-[960px]:px-4">
        <div className="flex flex-col gap-0.5">
          <span className={CAPTION}>Players</span>
          <span className="font-mono text-sm font-bold text-head">
            {player_count} / {max_players}
          </span>
        </div>
        {/* Every member sees the code; owners and admins regenerate it in Settings (1b). */}
        {join_code ? (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-0.5">
              <span className={CAPTION}>Join code</span>
              <span className="font-mono text-sm font-bold uppercase tracking-[0.08em] text-head">
                {join_code}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="relative z-[2] border-border"
              onClick={() => void handleCopyJoinCode()}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : null}
        <div className="relative z-[2] ml-auto">
          <CampaignPlayersDialog
            campaignId={id}
            campaignName={name}
            open={isRosterOpen}
            onOpenChange={setIsRosterOpen}
          />
        </div>
      </div>
    </Card>
  );
}
