import { useMemo, useState } from "react";

import { useNavigate, useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import MobileTabs from "@/components/ui/mobile-tabs";
import { useMediaQuery } from "@/lib/use-media-query";

import { useAppStore } from "@/stores/app-store";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import CataloguePager from "@/features/catalogue/components/CataloguePager";
import { useCatalogueSearchParams } from "@/features/catalogue/hooks/useCatalogueSearchParams";
import { usePagedList } from "@/features/catalogue/hooks/usePagedList";
import { useCatalogue } from "@/lib/catalogue-queries";
import { beastKindLabel, isBeastKind } from "../bestiary-kinds";
import { useBestiaryFavourites } from "../hooks/useBestiaryFavourites";
import BestiaryEntryCard from "../components/BestiaryEntryCard";
import BestiaryEntryDetail from "../components/BestiaryEntryDetail";
import BestiaryEntryFormDialog from "../components/BestiaryEntryFormDialog";
import BestiaryKindFilter from "../components/BestiaryKindFilter";

import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

import { LOADOUT_TABS } from "@/lib/loadout-tabs";
import type { LoadoutTabId } from "@/lib/loadout-tabs";

const PAGE_SIZE = 12;

export default function Bestiary() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const { warband } = useAppStore();

  // Every beast, of every kind, in one list the Kind filter narrows; the prebattle Load from
  // Bestiary picker shares it.
  const { data: entries, isLoading, error } = useCatalogue("bestiary", campaignId);
  const favourites = useBestiaryFavourites(warband?.id);
  const navigate = useNavigate();
  // Search, kind, page and the open entry live in the query string (CAT-NEW-02).
  const url = useCatalogueSearchParams();
  const searchQuery = url.get("q");
  const kindParam = url.get("kind");
  const selectedKind = isBeastKind(kindParam) ? kindParam : null;
  const setSearchQuery = (q: string) => url.set({ q, page: null });
  const selectedEntryId = url.get("entry") ? Number(url.get("entry")) : null;
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const canManage = campaignCapabilities(campaign).edit_catalogue;

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (selectedKind) {
      result = result.filter((e) => e.kind === selectedKind);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((e) =>
        [e.name, beastKindLabel(e.kind), e.description].some((text) =>
          text?.toLowerCase().includes(q)
        )
      );
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, selectedKind, searchQuery]);

  const pages = usePagedList(filteredEntries, PAGE_SIZE);

  const handleLoadoutTabChange = (tabId: LoadoutTabId) => {
    if (!id) return;
    navigate(`/campaigns/${id}/${tabId}`);
  };

  if (selectedEntryId !== null) {
    return (
      <div className="min-h-0 flex h-full flex-col gap-4 sm:gap-8">
        <PageHeader title="Bestiary" subtitle="Creatures and companions" />
        <BestiaryEntryDetail entryId={selectedEntryId} onClose={() => url.back("entry")} />
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
            className="w-full sm:max-w-sm"
          />
          <BestiaryKindFilter
            value={selectedKind}
            onChange={(kind) => url.set({ kind, page: null })}
          />
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
                  onClick={(e) => url.open({ entry: String(e.id) })}
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
