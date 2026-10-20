import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import { createCampaignBulletinEntry, deleteCampaignBulletinEntry } from "../../api/campaigns-api";
import {
  updateCachedList,
  useCampaignBulletin,
  useCampaignTopKillers,
} from "../../api/campaign-queries";

// other
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

// types
import type {
  CampaignBulletinEntry,
  CampaignTopKiller,
  PostRemovedBy,
} from "../../types/campaign-types";

const NO_ENTRIES: CampaignBulletinEntry[] = [];
const NO_KILLERS: CampaignTopKiller[] = [];

/**
 * The bulletin tab: its notes and top killers load only while it is open (PERF-43), and posting
 * or removing a note updates the cached notes with the server's answer.
 */
export function useBulletinBoard(campaignId: number, isOpen: boolean) {
  const queryClient = useQueryClient();
  const topKillers = useCampaignTopKillers(campaignId, { enabled: isOpen });
  const bulletin = useCampaignBulletin(campaignId, { enabled: isOpen });
  const [bulletinActionError, setBulletinActionError] = useState("");
  const [isCreatingBulletinEntry, setIsCreatingBulletinEntry] = useState(false);
  const [deletingBulletinEntryIds, setDeletingBulletinEntryIds] = useState<number[]>([]);
  const bulletinKey = queryKeys.campaign.bulletin(campaignId);

  const handleCreateBulletinEntry = async (body: string) => {
    setIsCreatingBulletinEntry(true);
    setBulletinActionError("");
    try {
      const entry = await createCampaignBulletinEntry(campaignId, body);
      updateCachedList<CampaignBulletinEntry>(queryClient, bulletinKey, (prev) => [entry, ...prev]);
      return entry;
    } catch (errorResponse) {
      setBulletinActionError(getErrorMessage(errorResponse, "Unable to post bulletin note"));
      throw errorResponse;
    } finally {
      setIsCreatingBulletinEntry(false);
    }
  };

  const handleDeleteBulletinEntry = async (entryId: number, removedBy: PostRemovedBy = "admin") => {
    setDeletingBulletinEntryIds((prev) => [...prev, entryId]);
    setBulletinActionError("");
    try {
      await deleteCampaignBulletinEntry(campaignId, entryId);
      // Soft (decision 8): the note stays in place, removed by its author or by an admin.
      updateCachedList<CampaignBulletinEntry>(queryClient, bulletinKey, (prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                body: "",
                removed_at: new Date().toISOString(),
                removed_by: removedBy,
              }
            : entry
        )
      );
    } catch (errorResponse) {
      setBulletinActionError(getErrorMessage(errorResponse, "Unable to remove bulletin note"));
      throw errorResponse;
    } finally {
      setDeletingBulletinEntryIds((prev) => prev.filter((value) => value !== entryId));
    }
  };

  return {
    topKillers: topKillers.data ?? NO_KILLERS,
    isTopKillersLoading: topKillers.isPending,
    topKillersError: topKillers.error
      ? getErrorMessage(topKillers.error, "Unable to load top killers")
      : "",
    bulletinEntries: bulletin.data ?? NO_ENTRIES,
    isBulletinLoading: bulletin.isPending,
    bulletinError: bulletin.error ? getErrorMessage(bulletin.error, "Unable to load bulletin") : "",
    bulletinActionError,
    isCreatingBulletinEntry,
    deletingBulletinEntryIds,
    handleCreateBulletinEntry,
    handleDeleteBulletinEntry,
  };
}
