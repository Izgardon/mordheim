import { useMemo, useState } from "react";

import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
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
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import CataloguePager from "@/features/catalogue/components/CataloguePager";
import { usePagedList } from "@/features/catalogue/hooks/usePagedList";
import { useCatalogue } from "@/lib/catalogue-queries";
import { useBestiaryFavourites } from "../hooks/useBestiaryFavourites";
import BestiaryEntryCard from "../components/BestiaryEntryCard";
import BestiaryEntryDetail from "../components/BestiaryEntryDetail";
import BestiaryEntryFormDialog from "../components/BestiaryEntryFormDialog";

import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

import { LOADOUT_TABS } from "@/lib/loadout-tabs";
import type { LoadoutTabId } from "@/lib/loadout-tabs";

const ALL_TYPES = "all";
const PAGE_SIZE = 12;

export default function Bestiary() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const { warband } = useAppStore();

  const { data: allEntries, isLoading, error } = useCatalogue("bestiary", campaignId);
  const entries = useMemo(
    () => allEntries.filter((e) => e.type.toLowerCase() !== "hired sword"),
    [allEntries]
  );
  const favourites = useBestiaryFavourites(warband?.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState(ALL_TYPES);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedEntryId = searchParams.get("entry") ? Number(searchParams.get("entry")) : null;
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const canManage = campaignCapabilities(campaign).edit_catalogue;

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

  const pages = usePagedList(
    filteredEntries,
    PAGE_SIZE,
    JSON.stringify([searchQuery, selectedType])
  );

  const handleLoadoutTabChange = (tabId: LoadoutTabId) => {
    if (!id) return;
    navigate(`/campaigns/${id}/${tabId}`);
  };

  if (selectedEntryId !== null) {
    return (
      <div className="min-h-0 flex h-full flex-col gap-4 sm:gap-8">
        <PageHeader title="Bestiary" subtitle="Creatures and companions" />
        <BestiaryEntryDetail entryId={selectedEntryId} onClose={() => navigate(-1)} />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex h-full flex-col gap-4 sm:gap-8">
      <PageHeader title="Bestiary" subtitle="Creatures and companions" />

      {isMobile ? (
        <MobileTabs
          tabs={LOADOUT_TABS}
          activeTab="bestiary"
          onTabChange={handleLoadoutTabChange}
          className="mt-2"
          showDivider
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-7">
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
            <p className="text-sm text-muted-foreground">No bestiary entries found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pages.paged.map((entry) => (
                <BestiaryEntryCard
                  key={entry.id}
                  entry={entry}
                  onClick={(e) => navigate(`?entry=${e.id}`)}
                  isFavourite={favourites.favouriteIds.has(entry.id)}
                  onToggleFavourite={warband ? favourites.toggle : undefined}
                />
              ))}
            </div>
          )}
        </div>

        <CataloguePager {...pages} />
      </div>

      <BestiaryEntryFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        campaignId={campaignId}
      />
    </div>
  );
}
