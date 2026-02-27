import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import MobileTabs from "@/components/ui/mobile-tabs";
import { useMediaQuery } from "@/lib/use-media-query";

import { useAppStore } from "@/stores/app-store";
import { listMyCampaignPermissions } from "@/features/campaigns/api/campaigns-api";
import {
  listBestiaryEntries,
  listWarbandBestiaryFavourites,
  addWarbandBestiaryFavourite,
  removeWarbandBestiaryFavourite,
} from "../api/bestiary-api";
import BestiaryEntryCard from "../components/BestiaryEntryCard";
import BestiaryEntryDetail from "../components/BestiaryEntryDetail";
import BestiaryEntryFormDialog from "../components/BestiaryEntryFormDialog";

import type { BestiaryEntrySummary } from "../types/bestiary-types";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

import { LOADOUT_TABS } from "@/lib/loadout-tabs";
import type { LoadoutTabId } from "@/lib/loadout-tabs";

const ALL_TYPES = "all";

export default function Bestiary() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const { warband } = useAppStore();

  const [entries, setEntries] = useState<BestiaryEntrySummary[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState(ALL_TYPES);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedEntryId = searchParams.get("entry") ? Number(searchParams.get("entry")) : null;
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);

  const canManage =
    campaign?.role === "owner" ||
    campaign?.role === "admin" ||
    memberPermissions.includes("manage_bestiary");

  useEffect(() => {
    if (campaign?.role !== "player" || !id) return;
    if (Number.isNaN(campaignId)) return;

    listMyCampaignPermissions(campaignId)
      .then((permissions) =>
        setMemberPermissions(permissions.map((p) => p.code))
      )
      .catch(() => setMemberPermissions([]));
  }, [campaign?.role, campaignId, id]);

  const loadEntries = useCallback(() => {
    if (Number.isNaN(campaignId)) return;
    setIsLoading(true);
    setError("");

    listBestiaryEntries({ campaignId })
      .then(setEntries)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load bestiary")
      )
      .finally(() => setIsLoading(false));
  }, [campaignId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!warband?.id) return;
    listWarbandBestiaryFavourites(warband.id)
      .then((favs) => setFavouriteIds(new Set(favs.map((f) => f.id))))
      .catch(() => setFavouriteIds(new Set()));
  }, [warband?.id]);

  const handleToggleFavourite = useCallback(
    async (entry: BestiaryEntrySummary) => {
      if (!warband?.id) return;
      const isFav = favouriteIds.has(entry.id);
      try {
        if (isFav) {
          await removeWarbandBestiaryFavourite(warband.id, entry.id);
          setFavouriteIds((prev) => {
            const next = new Set(prev);
            next.delete(entry.id);
            return next;
          });
        } else {
          await addWarbandBestiaryFavourite(warband.id, entry.id);
          setFavouriteIds((prev) => new Set(prev).add(entry.id));
        }
      } catch {
        // silently fail
      }
    },
    [warband?.id, favouriteIds]
  );

  const types = useMemo(() => {
    const unique = new Set(entries.map((e) => e.type));
    return Array.from(unique).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (selectedType !== ALL_TYPES) {
      result = result.filter((e) => e.type === selectedType);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, selectedType, searchQuery]);

  const handleLoadoutTabChange = (tabId: LoadoutTabId) => {
    if (!id) return;
    navigate(`/campaigns/${id}/${tabId}`);
  };

  if (selectedEntryId !== null) {
    return (
      <div className="flex h-full flex-col gap-4 overflow-hidden sm:gap-8">
        <PageHeader title="Bestiary" subtitle="Creatures and companions" />
        <BestiaryEntryDetail
          entryId={selectedEntryId}
          onClose={() => navigate(-1)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden sm:gap-8">
      <PageHeader title="Bestiary" subtitle="Creatures and companions" />

      {isMobile ? (
        <MobileTabs
          tabs={LOADOUT_TABS}
          activeTab="bestiary"
          onTabChange={handleLoadoutTabChange}
          className="mt-2"
        />
      ) : null}

      <CardBackground className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bestiary..."
            aria-label="Search bestiary"
            className="flex-none w-[calc(50%-6px)] sm:w-full sm:max-w-sm"
          />
          {types.length > 1 ? (
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[calc(50%-6px)] sm:w-56">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES}>All types</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {canManage ? (
            <Button size="sm" className="ml-auto" onClick={() => setShowCreateDialog(true)}>
              Add entry
            </Button>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <TableSkeleton columns={4} rows={8} />
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No bestiary entries found.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEntries.map((entry) => (
                <BestiaryEntryCard
                  key={entry.id}
                  entry={entry}
                  onClick={(e) => navigate(`?entry=${e.id}`)}
                  isFavourite={favouriteIds.has(entry.id)}
                  onToggleFavourite={warband ? handleToggleFavourite : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </CardBackground>

      <BestiaryEntryFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        campaignId={campaignId}
        onCreated={() => loadEntries()}
      />
    </div>
  );
}
