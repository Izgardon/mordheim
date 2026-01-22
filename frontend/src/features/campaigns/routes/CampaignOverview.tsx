import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { useAuth } from "../../auth/hooks/use-auth";
import { listCampaignPlayers } from "../api/campaigns-api";
import type { CampaignPlayer, CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

const defaultTypeLabel = "Standard";

export default function CampaignOverview() {
  const { id } = useParams();
  const { token } = useAuth();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [players, setPlayers] = useState<CampaignPlayer[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const typeLabel = useMemo(() => {
    if (!campaign?.campaign_type) {
      return defaultTypeLabel;
    }
    return campaign.campaign_type.replace(/_/g, " ");
  }, [campaign?.campaign_type]);

  useEffect(() => {
    if (!token || !id) {
      return;
    }

    const campaignId = Number(id);
    if (Number.isNaN(campaignId)) {
      setError("Invalid campaign id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    listCampaignPlayers(token, campaignId)
      .then((playerData) => setPlayers(playerData))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load players");
        } else {
          setError("Unable to load players");
        }
      })
      .finally(() => setIsLoading(false));
  }, [token, id]);

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  }

  return (
    <div className="space-y-6">
      <OverviewHeader campaign={campaign} typeLabel={typeLabel} />
      <PlayersCard isLoading={isLoading} error={error} players={players} />
    </div>
  );
}

type OverviewHeaderProps = {
  campaign: CampaignSummary;
  typeLabel: string;
};

function OverviewHeader({ campaign, typeLabel }: OverviewHeaderProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
        {typeLabel}
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">{campaign.name}</h1>
      <p className="mt-2 text-muted-foreground">
        {campaign.player_count} / {campaign.max_players} players accounted
      </p>
      <p className="mt-2 text-sm italic text-muted-foreground">"The ruins keep score."</p>
    </div>
  );
}

type PlayersCardProps = {
  isLoading: boolean;
  error: string;
  players: CampaignPlayer[];
};

function PlayersCard({ isLoading, error, players }: PlayersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roster</CardTitle>
        <CardDescription>Those who answered the call.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calling the roster...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No names logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {players.map((player) => (
              <li
                key={player.id}
                className="rounded-md border-2 border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground shadow-[2px_2px_0_rgba(23,16,8,0.15)]"
              >
                {player.name}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
