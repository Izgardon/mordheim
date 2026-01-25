import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

// routing
import { useNavigate } from "react-router-dom";

// components
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";

// types
import type { CampaignSummary } from "../types/campaign-types";

// other
import CampaignPlayersDialog from "./CampaignPlayersDialog";

const roleTone: Record<CampaignSummary["role"], string> = {
  owner: "bg-primary/15 text-primary border-primary/30",
  admin: "bg-accent/15 text-accent border-accent/30",
  player: "bg-secondary/40 text-foreground border-border/60",
};

const defaultTypeLabel = "Standard";

export default function CampaignCard({
  id,
  name,
  campaign_type,
  campaign_type_name,
  player_count,
  max_players,
  role,
  join_code,
}: CampaignSummary) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const typeLabel = useMemo(() => {
    if (campaign_type_name) {
      return campaign_type_name;
    }
    if (!campaign_type) {
      return defaultTypeLabel;
    }
    return campaign_type.replace(/_/g, " ");
  }, [campaign_type, campaign_type_name]);

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
      role="link"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${name}`}
      className="group cursor-pointer transition duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_18px_45px_rgba(5,24,24,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
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
          {role === "owner" ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Join code: {join_code}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  handleCopyJoinCode();
                }}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}




