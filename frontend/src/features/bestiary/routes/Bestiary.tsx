import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MobileTabs from "@/components/ui/mobile-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { ArchivedToggle } from "@/features/catalogue/components/ArchivedView";
import { LOADOUT_TABS, type LoadoutTabId } from "@/lib/loadout-tabs";
import { useMediaQuery } from "@/lib/use-media-query";
import { useAppStore } from "@/stores/app-store";

import BestiaryEntryDetail from "../components/BestiaryEntryDetail";
import BestiaryEntryFormDialog from "../components/BestiaryEntryFormDialog";
import BestiaryKindFilter from "../components/BestiaryKindFilter";
import BestiaryList from "../components/BestiaryList";
import { useBestiaryFavourites } from "../hooks/useBestiaryFavourites";
import { useBestiaryPage } from "../hooks/useBestiaryPage";

const TITLE = "Bestiary";
const SUBTITLE = "Mounts, pets and creatures";

/**
 * The Bestiary (pass 5's catalogue on cards, by kind): the Kind filter, search, the Archived list
 * with Restore, Add, and a beast's detail with Edit; the form edits book and custom beasts alike
 * (a book beast's first save makes the campaign's version), with Delete or Revert.
 */
export default function Bestiary() {
  const page = useBestiaryPage();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const { warband } = useAppStore();
  const favourites = useBestiaryFavourites(warband?.id);

  const formDialog = (
    <BestiaryEntryFormDialog
      campaignId={page.campaignId}
      open={page.form.open}
      onOpenChange={page.form.onOpenChange}
      editingId={page.form.editingId}
      defaultKind={page.kind ?? undefined}
      canDelete={page.canDelete}
      onSaved={page.form.onSaved}
      onDeleted={page.form.onDeleted}
      onReverted={page.form.onReverted}
      onEditMatch={page.form.onEditMatch}
    />
  );

  if (page.openEntryId !== null) {
    const entryId = page.openEntryId;
    return (
      <div className="min-h-0 flex h-full flex-col gap-4 sm:gap-8">
        <PageHeader title={TITLE} subtitle={SUBTITLE} />
        <BestiaryEntryDetail
          campaignId={page.campaignId}
          entryId={entryId}
          onClose={page.closeEntry}
          onEdit={page.canEdit ? () => page.form.edit(entryId) : undefined}
        />
        {formDialog}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex h-full flex-col gap-4 sm:gap-8">
      <PageHeader title={TITLE} subtitle={SUBTITLE} />

      {isMobile ? (
        <MobileTabs
          tabs={LOADOUT_TABS}
          activeTab="bestiary"
          onTabChange={(tabId: LoadoutTabId) => navigate(`/campaigns/${page.campaignId}/${tabId}`)}
          className="mt-2"
          showDivider
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            value={page.searchQuery}
            onChange={(event) => page.setSearchQuery(event.target.value)}
            placeholder="Search bestiary..."
            aria-label="Search bestiary"
            className="w-full sm:max-w-sm"
          />
          <BestiaryKindFilter value={page.kind} onChange={page.setKind} />
          <ArchivedToggle checked={page.archive.archived} onChange={page.archive.setArchived} />
          {page.canEdit && !page.archive.archived ? (
            <Button size="sm" className="ml-auto" onClick={page.form.add}>
              Add entry
            </Button>
          ) : null}
        </div>

        <BestiaryList page={page} favourites={warband ? favourites : null} />
      </div>

      {formDialog}
    </div>
  );
}
