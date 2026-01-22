import { useMemo } from "react";

// routing
import { Link } from "react-router-dom";

// components
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";

// types
import type { CampaignSummary } from "../types/campaign-types";

// other
import CampaignPlayersDialog from "./CampaignPlayersDialog";

const roleTone: Record<CampaignSummary["role"], string> = {
  owner: "bg-red-600/10 text-red-700 border-red-200",
  admin: "bg-amber-500/10 text-amber-700 border-amber-200",
  player: "bg-slate-500/10 text-foreground border-slate-200",
};

const defaultTypeLabel = "Standard";

export default function CampaignCard({
  id,
  name,
  campaign_type,
  player_count,
  max_players,
  role,
}: CampaignSummary) {
  const typeLabel = useMemo(() => {
    if (!campaign_type) {
      return defaultTypeLabel;
    }
    return campaign_type.replace(/_/g, " ");
  }, [campaign_type]);

  const roleLabel = useMemo(() => {
    if (!role) {
      return "Player";
    }
    return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  }, [role]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>
              <Link
                to={`/campaigns/${id}`}
                className="text-slate-500 transition hover:text-slate-400"
                aria-label={`Open ${name}`}
              >
                {name}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1 capitalize text-slate-400">
              {typeLabel}
            </CardDescription>
          </div>
          <Badge variant="outline" className={roleTone[role]}>
            {roleLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>
            {player_count} / {max_players} players accounted
          </span>
          <CampaignPlayersDialog campaignId={id} campaignName={name} />
        </div>
      </CardContent>
    </Card>
  );
}




