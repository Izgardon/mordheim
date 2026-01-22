import { useMemo } from "react";
import type { KeyboardEvent } from "react";

// routing
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
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

  const handleOpen = () => {
    navigate(`/campaigns/${id}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    handleOpen();
  };

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${name}`}
      className="group cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:border-foreground/70 hover:shadow-[10px_10px_0_rgba(23,16,8,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-foreground transition group-hover:text-foreground">
              {name}
            </CardTitle>
            <CardDescription className="mt-1 capitalize text-muted-foreground">
              {typeLabel}
            </CardDescription>
          </div>
          <Badge variant="outline" className={roleTone[role]}>
            {roleLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {player_count} / {max_players} players accounted
          </span>
          <div
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <CampaignPlayersDialog campaignId={id} campaignName={name} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}




