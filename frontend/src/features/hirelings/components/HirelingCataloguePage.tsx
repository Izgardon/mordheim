import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MobileTabs from "@/components/ui/mobile-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { ArchivedToggle } from "@/features/catalogue/components/ArchivedView";
import { LOADOUT_TABS, type LoadoutTabId } from "@/lib/loadout-tabs";
import { useMediaQuery } from "@/lib/use-media-query";

import { useHirelingCataloguePage } from "../hooks/useHirelingCataloguePage";
import HirelingCatalogueList from "./HirelingCatalogueList";
import HirelingProfileDetailPanel from "./HirelingProfileDetailPanel";
import HirelingProfileFormDialog from "./HirelingProfileFormDialog";

import type { HirelingCatalogueConfig } from "../hireling-catalogue-kinds";

/**
 * The Hired Swords or Dramatis Personae page (pass 5's catalogue on cards): search, the Archived
 * list with Restore, Add, and an entry's detail with Edit; the form edits book and custom entries
 * alike (a book entry's first save makes the campaign's version), with Delete or Revert.
 */
export default function HirelingCataloguePage({ config }: { config: HirelingCatalogueConfig }) {
  const page = useHirelingCataloguePage(config);
  const { labels } = config;
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 960px)");

  const formDialog = (
    <HirelingProfileFormDialog
      config={config}
      campaignId={page.campaignId}
      open={page.form.open}
      onOpenChange={page.form.onOpenChange}
      editingId={page.form.editingId}
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
        <PageHeader title={labels.title} subtitle={labels.subtitle} />
        <HirelingProfileDetailPanel
          config={config}
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
      <PageHeader title={labels.title} subtitle={labels.subtitle} />

      {isMobile ? (
        <MobileTabs
          tabs={LOADOUT_TABS}
          activeTab={config.kind}
          onTabChange={(tabId: LoadoutTabId) => navigate(`/campaigns/${page.campaignId}/${tabId}`)}
          className="mt-2"
          showDivider
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-2 sm:px-0">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            value={page.searchQuery}
            onChange={(event) => page.setSearchQuery(event.target.value)}
            placeholder={`${labels.search}...`}
            aria-label={labels.search}
            className="max-w-sm flex-1 sm:flex-none"
          />
          <ArchivedToggle checked={page.archive.archived} onChange={page.archive.setArchived} />
          {page.canEdit && !page.archive.archived ? (
            <Button size="sm" className="ml-auto" onClick={page.form.add}>
              {labels.add}
            </Button>
          ) : null}
        </div>

        <HirelingCatalogueList page={page} />
      </div>

      {formDialog}
    </div>
  );
}
