import { useEffect, useMemo, useState } from "react";

// api
import { listCampaignPlayers, updateCampaign } from "../api/campaigns-api";
import { listWarbandHeroes } from "../../warbands/api/warbands-api";

// stores
import { useAppStore } from "@/stores/app-store";

// types
import type { CampaignPlayer, CampaignSummary } from "../types/campaign-types";
import type { WarbandHero } from "../../warbands/types/warband-types";

const defaultTypeLabel = "Standard";

type UseCampaignOverviewParams = {
  campaignId: number;
  campaign: CampaignSummary | null;
};

export function useCampaignOverview({ campaignId, campaign }: UseCampaignOverviewParams) {
  const [players, setPlayers] = useState<CampaignPlayer[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPlayers, setExpandedPlayers] = useState<number[]>([]);
  const [heroSnapshots, setHeroSnapshots] = useState<Record<number, WarbandHero[]>>({});
  const [snapshotLoading, setSnapshotLoading] = useState<Record<number, boolean>>({});
  const [snapshotErrors, setSnapshotErrors] = useState<Record<number, string>>({});
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [isUnderway, setIsUnderway] = useState(campaign?.in_progress ?? false);

  const { setCampaignStarted } = useAppStore();

  const typeLabel = useMemo(() => {
    if (!campaign?.campaign_type) {
      return defaultTypeLabel;
    }
    return campaign.campaign_type.replace(/_/g, " ");
  }, [campaign?.campaign_type]);

  useEffect(() => {
    if (campaign) {
      setIsUnderway(campaign.in_progress);
    }
  }, [campaign]);

  useEffect(() => {
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
  }, [campaignId]);

  const canStartCampaign = campaign?.role === "owner" || campaign?.role === "admin";

  const togglePlayer = (player: CampaignPlayer) => {
    setExpandedPlayers((prev) => {
      const isExpanded = prev.includes(player.id);
      if (isExpanded) {
        return prev.filter((entry) => entry !== player.id);
      }
      return [...prev, player.id];
    });

    const warbandId = player.warband?.id;
    if (!warbandId) {
      return;
    }

    if (heroSnapshots[warbandId] || snapshotLoading[warbandId]) {
      return;
    }

    setSnapshotLoading((prev) => ({ ...prev, [warbandId]: true }));
    setSnapshotErrors((prev) => ({ ...prev, [warbandId]: "" }));

    listWarbandHeroes(warbandId)
      .then((heroes) => {
        setHeroSnapshots((prev) => ({ ...prev, [warbandId]: heroes }));
      })
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setSnapshotErrors((prev) => ({
            ...prev,
            [warbandId]: errorResponse.message || "Unable to load warband heroes",
          }));
        } else {
          setSnapshotErrors((prev) => ({ ...prev, [warbandId]: "Unable to load warband heroes" }));
        }
      })
      .finally(() => {
        setSnapshotLoading((prev) => ({ ...prev, [warbandId]: false }));
      });
  };

  const handleStartCampaign = async () => {
    if (!campaign) {
      return;
    }

    setIsStarting(true);
    setStartError("");

    try {
      await updateCampaign(campaign.id, { in_progress: true });
      setIsUnderway(true);
      setCampaignStarted(true);
      setIsStartOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setStartError(errorResponse.message || "Unable to start campaign");
      } else {
        setStartError("Unable to start campaign");
      }
    } finally {
      setIsStarting(false);
    }
  };

  return {
    players,
    isLoading,
    error,
    expandedPlayers,
    heroSnapshots,
    snapshotLoading,
    snapshotErrors,
    togglePlayer,
    typeLabel,
    canStartCampaign,
    isUnderway,
    isStartOpen,
    setIsStartOpen,
    isStarting,
    startError,
    handleStartCampaign,
  };
}
