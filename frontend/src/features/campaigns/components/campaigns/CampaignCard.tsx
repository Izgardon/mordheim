import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

// routing
import { useNavigate } from "react-router-dom";

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
  owner: "bg-primary/15 text-primary border-primary/30",
  admin: "bg-accent/15 text-accent border-accent/30",
  player: "bg-secondary/40 text-foreground border-border/60",
};

export default function CampaignCard({
  id,
  name,
  player_count,
  max_players,
  role,
  join_code,
}: CampaignSummary) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

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
    <div
      role="link"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${name}`}
      className="group cursor-pointer rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
    <CardBackground className="rounded-3xl p-1 transition duration-200 group-hover:shadow-[0_18px_45px_rgba(5,24,24,0.4),0_0_28px_rgba(57,255,77,0.25),inset_0_0_0_1px_rgba(57,255,77,0.5),inset_0_0_28px_rgba(57,255,77,0.15)]">
    <Card className="min-w-0 rounded-[20px]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="break-words text-foreground transition group-hover:text-foreground">
              {name}
            </CardTitle>
          </div>
          <Badge variant="outline" className={roleTone[role]}>
            {roleLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-xs text-muted-foreground sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
              <span className="min-w-0 text-xs text-muted-foreground sm:text-sm">
                Join code: <span className="font-semibold text-foreground">{join_code}</span>
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 px-3 text-[0.5rem] sm:h-10 sm:px-5 sm:text-[0.6rem]"
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
    </CardBackground>
    </div>
  );
}





