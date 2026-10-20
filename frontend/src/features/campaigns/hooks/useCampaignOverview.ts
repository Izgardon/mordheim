import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

// api
import {
  createCampaignBulletinEntry,
  deleteCampaignBulletinEntry,
  listCampaignBattleHistory,
  listCampaignBulletinEntries,
  listCampaignPivotalMoments,
  listCampaignPlayers,
  listCampaignTopKillers,
  listCampaignTradeRequests,
  updateCampaign,
} from "../api/campaigns-api";
import { getWarbandRosterStats, type RosterStatsRow } from "../../warbands/api/warbands-core";

// types
import type {
  CampaignBattleHistoryEntry,
  CampaignBulletinEntry,
  CampaignPlayer,
  CampaignPivotalMoment,
  CampaignSummary,
  CampaignTopKiller,
} from "../types/campaign-types";
import type { TradeRequest } from "@/features/warbands/types/trade-request-types";

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
  armour_save: number | null;
};

/** A `roster-stats/` row as the roster's units table shows it, keyed by kind. */
const toRosterUnit =
  (prefix: string, category: RosterUnit["category"]) =>
  ({ id, ...stats }: RosterStatsRow): RosterUnit => ({ id: `${prefix}-${id}`, category, ...stats });

type UseCampaignOverviewParams = {
  campaignId: number;
  campaign: CampaignSummary | null;
  /** Writes an answer into the cached campaign (the layout's query), which the overview reads. */
  setCampaign?: Dispatch<SetStateAction<CampaignSummary | null>>;
  /** The bulletin tab's data (bulletin, top killers) loads only while that tab is open. */
  activeTab: "overview" | "bulletin";
};

export function useCampaignOverview({
  campaignId,
  campaign,
  setCampaign,
  activeTab,
}: UseCampaignOverviewParams) {
  const isBulletinOpen = activeTab === "bulletin";
  const [players, setPlayers] = useState<CampaignPlayer[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [tradeRequests, setTradeRequests] = useState<TradeRequest[]>([]);
  const [tradeError, setTradeError] = useState("");
  const [isTradesLoading, setIsTradesLoading] = useState(true);
  const [battleHistory, setBattleHistory] = useState<CampaignBattleHistoryEntry[]>([]);
  // Raised to read the history again (a battle record edited, BATL-NEW-04).
  const [battleHistoryVersion, setBattleHistoryVersion] = useState(0);
  const reloadBattleHistory = useCallback(() => setBattleHistoryVersion((value) => value + 1), []);
  const [battleHistoryError, setBattleHistoryError] = useState("");
  const [isBattleHistoryLoading, setIsBattleHistoryLoading] = useState(true);
  const [pivotalMoments, setPivotalMoments] = useState<CampaignPivotalMoment[]>([]);
  const [pivotalMomentsError, setPivotalMomentsError] = useState("");
  const [isPivotalMomentsLoading, setIsPivotalMomentsLoading] = useState(true);
  const [topKillers, setTopKillers] = useState<CampaignTopKiller[]>([]);
  const [topKillersError, setTopKillersError] = useState("");
  const [isTopKillersLoading, setIsTopKillersLoading] = useState(true);
  const [bulletinEntries, setBulletinEntries] = useState<CampaignBulletinEntry[]>([]);
  const [bulletinError, setBulletinError] = useState("");
  const [isBulletinLoading, setIsBulletinLoading] = useState(true);
  const [bulletinActionError, setBulletinActionError] = useState("");
  const [isCreatingBulletinEntry, setIsCreatingBulletinEntry] = useState(false);
  const [deletingBulletinEntryIds, setDeletingBulletinEntryIds] = useState<number[]>([]);
  const [expandedPlayers, setExpandedPlayers] = useState<number[]>([]);
  const [heroSnapshots, setHeroSnapshots] = useState<Record<number, RosterUnit[]>>({});
  const [snapshotLoading, setSnapshotLoading] = useState<Record<number, boolean>>({});
  const [snapshotErrors, setSnapshotErrors] = useState<Record<number, string>>({});
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState("");
  // Read from the cached campaign, which the start writes to (BUG-14): the layout copies it into
  // the store's campaignStarted for the XP bar.
  const isUnderway = campaign?.in_progress ?? false;

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

  useEffect(() => {
    if (Number.isNaN(campaignId)) {
      setBattleHistoryError("Invalid campaign id.");
      setIsBattleHistoryLoading(false);
      return;
    }

    setIsBattleHistoryLoading(true);
    setBattleHistoryError("");

    listCampaignBattleHistory(campaignId)
      .then((data) => setBattleHistory(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setBattleHistoryError(errorResponse.message || "Unable to load battle history");
        } else {
          setBattleHistoryError("Unable to load battle history");
        }
      })
      .finally(() => setIsBattleHistoryLoading(false));
  }, [campaignId, battleHistoryVersion]);

  useEffect(() => {
    if (Number.isNaN(campaignId)) {
      setPivotalMomentsError("Invalid campaign id.");
      setIsPivotalMomentsLoading(false);
      return;
    }

    setIsPivotalMomentsLoading(true);
    setPivotalMomentsError("");

    listCampaignPivotalMoments(campaignId)
      .then((data) => setPivotalMoments(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setPivotalMomentsError(errorResponse.message || "Unable to load pivotal moments");
        } else {
          setPivotalMomentsError("Unable to load pivotal moments");
        }
      })
      .finally(() => setIsPivotalMomentsLoading(false));
  }, [campaignId]);

  useEffect(() => {
    if (!isBulletinOpen) {
      return; // PERF-43: the bulletin tab has no entry point; don't fetch for it unseen.
    }
    if (Number.isNaN(campaignId)) {
      setTopKillersError("Invalid campaign id.");
      setIsTopKillersLoading(false);
      return;
    }

    setIsTopKillersLoading(true);
    setTopKillersError("");

    listCampaignTopKillers(campaignId)
      .then((data) => setTopKillers(data.top_killers))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setTopKillersError(errorResponse.message || "Unable to load top killers");
        } else {
          setTopKillersError("Unable to load top killers");
        }
      })
      .finally(() => setIsTopKillersLoading(false));
  }, [campaignId, isBulletinOpen]);

  useEffect(() => {
    if (!isBulletinOpen) {
      return;
    }
    if (Number.isNaN(campaignId)) {
      setBulletinError("Invalid campaign id.");
      setIsBulletinLoading(false);
      return;
    }

    setIsBulletinLoading(true);
    setBulletinError("");

    listCampaignBulletinEntries(campaignId)
      .then((data) => setBulletinEntries(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setBulletinError(errorResponse.message || "Unable to load bulletin");
        } else {
          setBulletinError("Unable to load bulletin");
        }
      })
      .finally(() => setIsBulletinLoading(false));
  }, [campaignId, isBulletinOpen]);

  // Owners and admins start the campaign (decision 2, BUG-13).
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

    // One request for the three kinds' stat lines (PERF-42).
    getWarbandRosterStats(warbandId)
      .then((stats) => {
        const units: RosterUnit[] = [
          ...stats.heroes.map(toRosterUnit("hero", "Heroes")),
          ...stats.henchmen_groups.map(toRosterUnit("henchmen", "Henchmen")),
          ...stats.hired_swords.map(toRosterUnit("hs", "Hired Swords")),
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
      setCampaign?.(await updateCampaign(campaign.id, { in_progress: true }));
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

  const handleCreateBulletinEntry = async (body: string) => {
    setIsCreatingBulletinEntry(true);
    setBulletinActionError("");

    try {
      const entry = await createCampaignBulletinEntry(campaignId, body);
      setBulletinEntries((prev) => [entry, ...prev]);
      return entry;
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setBulletinActionError(errorResponse.message || "Unable to post bulletin note");
      } else {
        setBulletinActionError("Unable to post bulletin note");
      }
      throw errorResponse;
    } finally {
      setIsCreatingBulletinEntry(false);
    }
  };

  const handleDeleteBulletinEntry = async (entryId: number) => {
    setDeletingBulletinEntryIds((prev) => [...prev, entryId]);
    setBulletinActionError("");

    try {
      await deleteCampaignBulletinEntry(campaignId, entryId);
      setBulletinEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setBulletinActionError(errorResponse.message || "Unable to remove bulletin note");
      } else {
        setBulletinActionError("Unable to remove bulletin note");
      }
      throw errorResponse;
    } finally {
      setDeletingBulletinEntryIds((prev) => prev.filter((value) => value !== entryId));
    }
  };

  return {
    players,
    isLoading,
    error,
    tradeRequests,
    tradeError,
    isTradesLoading,
    battleHistory,
    battleHistoryError,
    reloadBattleHistory,
    isBattleHistoryLoading,
    pivotalMoments,
    pivotalMomentsError,
    isPivotalMomentsLoading,
    topKillers,
    topKillersError,
    isTopKillersLoading,
    bulletinEntries,
    bulletinError,
    isBulletinLoading,
    bulletinActionError,
    isCreatingBulletinEntry,
    deletingBulletinEntryIds,
    expandedPlayers,
    heroSnapshots,
    snapshotLoading,
    snapshotErrors,
    togglePlayer,
    canStartCampaign,
    isUnderway,
    isStartOpen,
    setIsStartOpen,
    isStarting,
    startError,
    handleStartCampaign,
    handleCreateBulletinEntry,
    handleDeleteBulletinEntry,
  };
}
