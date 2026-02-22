import { useEffect, useMemo, useState } from "react";

// api
import { listCampaignPlayers, listCampaignTradeRequests, updateCampaign } from "../api/campaigns-api";
import { listWarbandHeroes } from "../../warbands/api/warbands-api";
import { listWarbandHenchmenGroups } from "../../warbands/api/warbands-henchmen";
import { listWarbandHiredSwords } from "../../warbands/api/warbands-hiredswords";

// stores
import { useAppStore } from "@/stores/app-store";

// types
import type { CampaignPlayer, CampaignSummary } from "../types/campaign-types";
import type { TradeRequest } from "@/features/warbands/types/trade-request-types";

const defaultTypeLabel = "Standard";

export type RosterUnit = {
  id: string;
  category: "Heroes" | "Henchmen" | "Hired Swords";
  name: string | null;
  unit_type: string | null;
  movement: number | null;
  weapon_skill: number | null;
  ballistic_skill: number | null;
  strength: number | null;
  toughness: number | null;
  wounds: number | null;
  initiative: number | null;
  attacks: number | null;
  leadership: number | null;
  armour_save: string | null;
};

type UseCampaignOverviewParams = {
  campaignId: number;
  campaign: CampaignSummary | null;
};

export function useCampaignOverview({ campaignId, campaign }: UseCampaignOverviewParams) {
  const [players, setPlayers] = useState<CampaignPlayer[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [tradeRequests, setTradeRequests] = useState<TradeRequest[]>([]);
  const [tradeError, setTradeError] = useState("");
  const [isTradesLoading, setIsTradesLoading] = useState(true);
  const [expandedPlayers, setExpandedPlayers] = useState<number[]>([]);
  const [heroSnapshots, setHeroSnapshots] = useState<Record<number, RosterUnit[]>>({});
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

  useEffect(() => {
    if (Number.isNaN(campaignId)) {
      setTradeError("Invalid campaign id.");
      setIsTradesLoading(false);
      return;
    }

    setIsTradesLoading(true);
    setTradeError("");

    listCampaignTradeRequests(campaignId, "completed")
      .then((data) => setTradeRequests(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setTradeError(errorResponse.message || "Unable to load trades");
        } else {
          setTradeError("Unable to load trades");
        }
      })
      .finally(() => setIsTradesLoading(false));
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

    Promise.all([
      listWarbandHeroes(warbandId),
      listWarbandHenchmenGroups(warbandId),
      listWarbandHiredSwords(warbandId),
    ])
      .then(([heroes, henchmenGroups, hiredSwords]) => {
        const units: RosterUnit[] = [
          ...heroes.map((h) => ({
            id: `hero-${h.id}`,
            category: "Heroes" as const,
            name: h.name,
            unit_type: h.unit_type,
            movement: h.movement,
            weapon_skill: h.weapon_skill,
            ballistic_skill: h.ballistic_skill,
            strength: h.strength,
            toughness: h.toughness,
            wounds: h.wounds,
            initiative: h.initiative,
            attacks: h.attacks,
            leadership: h.leadership,
            armour_save: h.armour_save,
          })),
          ...henchmenGroups.map((g) => ({
            id: `henchmen-${g.id}`,
            category: "Henchmen" as const,
            name: g.name,
            unit_type: g.unit_type,
            movement: g.movement,
            weapon_skill: g.weapon_skill,
            ballistic_skill: g.ballistic_skill,
            strength: g.strength,
            toughness: g.toughness,
            wounds: g.wounds,
            initiative: g.initiative,
            attacks: g.attacks,
            leadership: g.leadership,
            armour_save: g.armour_save,
          })),
          ...hiredSwords.map((s) => ({
            id: `hs-${s.id}`,
            category: "Hired Swords" as const,
            name: s.name,
            unit_type: s.unit_type,
            movement: s.movement,
            weapon_skill: s.weapon_skill,
            ballistic_skill: s.ballistic_skill,
            strength: s.strength,
            toughness: s.toughness,
            wounds: s.wounds,
            initiative: s.initiative,
            attacks: s.attacks,
            leadership: s.leadership,
            armour_save: s.armour_save,
          })),
        ];
        setHeroSnapshots((prev) => ({ ...prev, [warbandId]: units }));
      })
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setSnapshotErrors((prev) => ({
            ...prev,
            [warbandId]: errorResponse.message || "Unable to load warband roster",
          }));
        } else {
          setSnapshotErrors((prev) => ({ ...prev, [warbandId]: "Unable to load warband roster" }));
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
    tradeRequests,
    tradeError,
    isTradesLoading,
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
