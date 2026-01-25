import { useEffect, useMemo, useState } from "react";

// routing
import { Link, useOutletContext, useParams } from "react-router-dom";

// components
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

// api
import { listCampaignPlayers } from "../api/campaigns-api";

// types
import type { CampaignPlayer, CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

const defaultTypeLabel = "Standard";

export default function CampaignOverview() {
  const { id } = useParams();
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
    if (!id) {
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

    listCampaignPlayers(campaignId)
      .then((playerData) => setPlayers(playerData))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load players");
        } else {
          setError("Unable to load players");
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  }

  return (
    <div className="space-y-6">
      <OverviewHeader campaign={campaign} typeLabel={typeLabel} />
      <PlayersCard
        campaignId={campaign.id}
        isLoading={isLoading}
        error={error}
        players={players}
      />
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
        {campaign.player_count} / {campaign.max_players} players
      </p>
    </div>
  );
}

type PlayersCardProps = {
  campaignId: number;
  isLoading: boolean;
  error: string;
  players: CampaignPlayer[];
};

function PlayersCard({ campaignId, isLoading, error, players }: PlayersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roster</CardTitle>
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
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card/70 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.3)]"
              >
                <div>
                  <p className="font-semibold text-foreground">{player.name}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {player.warband?.faction || "No warband"}
                  </p>
                </div>
                {player.warband ? (
                  <Link
                    to={`/campaigns/${campaignId}/warbands/${player.warband.id}`}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                  >
                    {player.warband.name}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">Unassigned</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}




