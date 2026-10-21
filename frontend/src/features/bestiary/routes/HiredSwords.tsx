import { useMemo, useState } from "react";

import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import MobileTabs from "@/components/ui/mobile-tabs";
import { useMediaQuery } from "@/lib/use-media-query";

import { campaignCapabilities } from "@/features/campaigns/capabilities";
import CataloguePager from "@/features/catalogue/components/CataloguePager";
import { usePagedList } from "@/features/catalogue/hooks/usePagedList";
import { useCatalogue } from "@/lib/catalogue-queries";
import HiredSwordProfileCard from "../components/HiredSwordProfileCard";
import HiredSwordProfileDetail from "../components/HiredSwordProfileDetail";
import HiredSwordProfileFormDialog from "../components/HiredSwordProfileFormDialog";

import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

import { LOADOUT_TABS } from "@/lib/loadout-tabs";
import type { LoadoutTabId } from "@/lib/loadout-tabs";

const PAGE_SIZE = 12;

export default function HiredSwords() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");

  const { data: profiles, isLoading, error } = useCatalogue("hired-swords", campaignId);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedProfileId = searchParams.get("profile")
    ? Number(searchParams.get("profile"))
    : null;
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const canManage = campaignCapabilities(campaign).edit_catalogue;

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // Copy before sorting: the list is the shared query cache.
    if (!q)
      return [...profiles].sort((a, b) =>
        a.bestiary_entry.name.localeCompare(b.bestiary_entry.name)
      );
    return profiles
      .filter(
        (p) =>
          p.bestiary_entry.name.toLowerCase().includes(q) ||
          p.bestiary_entry.description.toLowerCase().includes(q)
      )
      .sort((a, b) => a.bestiary_entry.name.localeCompare(b.bestiary_entry.name));
  }, [profiles, searchQuery]);

  const pages = usePagedList(filteredProfiles, PAGE_SIZE, searchQuery);

  const handleLoadoutTabChange = (tabId: LoadoutTabId) => {
    if (!id) return;
    navigate(`/campaigns/${id}/${tabId}`);
  };

  if (selectedProfileId !== null) {
    return (
      <div className="min-h-0 flex h-full flex-col gap-4 sm:gap-8">
        <PageHeader title="Hired Swords" subtitle="Mercenaries for hire" />
        <HiredSwordProfileDetail profileId={selectedProfileId} onClose={() => navigate(-1)} />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex h-full flex-col gap-4 sm:gap-8">
      <PageHeader title="Hired Swords" subtitle="Mercenaries for hire" />

      {isMobile ? (
        <MobileTabs
          tabs={LOADOUT_TABS}
          activeTab="hired-swords"
          onTabChange={handleLoadoutTabChange}
          className="mt-2"
          showDivider
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-2 sm:px-0">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hired swords..."
            aria-label="Search hired swords"
            className="max-w-sm flex-1 sm:flex-none"
          />
          {canManage ? (
            <Button size="sm" className="ml-auto" onClick={() => setShowCreateDialog(true)}>
              Add hired sword
            </Button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <TableSkeleton columns={4} rows={8} />
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filteredProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hired swords found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pages.paged.map((profile) => (
                <HiredSwordProfileCard
                  key={profile.id}
                  profile={profile}
                  onClick={(p) => navigate(`?profile=${p.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        <CataloguePager {...pages} />
      </div>

      <HiredSwordProfileFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        campaignId={campaignId}
      />
    </div>
  );
}
