import { useId, useMemo, useState } from "react";

// routing
import { Link } from "react-router-dom";

// components
import { Badge } from "@components/badge";
import { Button } from "@components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { CardBackground } from "@components/card-background";

// types
import type { CampaignSummary } from "../../types/campaign-types";

// other
import CampaignPlayersDialog from "../dialogs/CampaignPlayersDialog";

const roleTone: Record<CampaignSummary["role"], string> = {
  owner: "campaign-card-badge campaign-card-badge--owner",
  admin: "campaign-card-badge campaign-card-badge--admin",
  player: "campaign-card-badge campaign-card-badge--player",
};

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
    <article aria-labelledby={titleId} className="campaign-ornate-card-link group cursor-pointer">
      <CardBackground className="campaign-ornate-frame">
        <Card className="campaign-ornate-card min-w-0">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[0.58rem] uppercase tracking-[0.28em] text-[#b79a6f]">
                  Campaign Ledger
                </p>
                <CardTitle
                  id={titleId}
                  className="theme-heading-soft break-words text-xl font-bold text-[#f0dfbc] transition group-hover:text-[#fff1d6]"
                >
                  <Link
                    to={`/campaigns/${id}`}
                    className="campaign-card-open outline-none after:absolute after:inset-0 after:z-[1] after:content-['']"
                  >
                    {name}
                  </Link>
                </CardTitle>
              </div>
              <Badge variant="outline" className={roleTone[role]}>
                {roleLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="campaign-card-meta flex flex-wrap items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-xs text-[#c8b59a] sm:text-sm">
              <span>
                {player_count} / {max_players} players accounted
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
              <div className="campaign-card-meta flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5">
                <span className="min-w-0 text-xs text-[#c8b59a] sm:text-sm">
                  Join code:{" "}
                  <span className="campaign-card-code font-semibold uppercase text-[#f3e3c3]">
                    {join_code}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="relative z-[2] h-8 border-[#7c5c37] bg-[#20160d] px-3 text-[0.5rem] text-[#ecd6ad] hover:bg-[#2a1d12] hover:text-[#f6e7c7] sm:h-10 sm:px-5 sm:text-[0.6rem]"
                  onClick={() => void handleCopyJoinCode()}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </CardBackground>
    </article>
  );
}
