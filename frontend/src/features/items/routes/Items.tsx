import { useMemo, useState } from "react";

// routing
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

// data
import { useCatalogue } from "@/lib/catalogue-queries";
import { useCatalogueEditor } from "@/features/catalogue/hooks/useCatalogueEditor";
import { useItemsFilters } from "../hooks/useItemsFilters";

// components
import { Button } from "@components/button";
import { TableSkeleton } from "@components/table-skeleton";
import { Tooltip } from "@components/tooltip";
import { PageHeader } from "@components/page-header";
import MobileTabs from "@components/mobile-tabs";
import CatalogueTable from "@/features/catalogue/components/CatalogueTable";
import { EditRowButton } from "@/features/catalogue/components/EditRowButton";
import AddItemForm from "../components/AddItemForm";
import AcquireItemDialog from "../components/AcquireItemDialog/AcquireItemDialog";
import BuyItemButton from "../components/AcquireItemDialog/BuyItemButton";
import ItemsFilterBar from "../components/ItemsFilterBar";
import {
  itemColumns,
  itemsMobileLayout,
  type ItemRow,
  type ItemTabId,
} from "../components/items-columns";

// utils
import { formatAvailabilitySummary } from "../utils/availability-format";

// api
import { campaignCapabilities } from "@/features/campaigns/capabilities";

// types
import type { Item, ItemProperty } from "../types/item-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

import { LOADOUT_TABS } from "@/lib/loadout-tabs";
import type { LoadoutTabId } from "@/lib/loadout-tabs";

const itemTabs: ReadonlyArray<{ id: ItemTabId; label: string }> = [
  { id: "weapons", label: "Weapons" },
  { id: "armour", label: "Armour" },
  { id: "misc", label: "Miscellaneous" },
  { id: "animals", label: "Animals" },
];

const byId = (properties: ItemProperty[]) =>
  properties.reduce<Record<number, ItemProperty>>((acc, property) => {
    acc[property.id] = property;
    return acc;
  }, {});

const subtitle = (item: ItemRow) => formatAvailabilitySummary(item._availability);
const description = (item: ItemRow) =>
  item.description?.trim() ? item.description : "No description available.";

export default function Items() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const navigate = useNavigate();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");
  // Shares the cached campaign item list with the warband editor instead of re-downloading it.
  const { data: items, isLoading, error } = useCatalogue("items", campaignId);
  const { data: itemProperties, error: propertyError } = useCatalogue(
    "item-properties",
    campaignId
  );
  const propertyMap = useMemo(() => byId(itemProperties), [itemProperties]);
  const filters = useItemsFilters(items);
  // AddItemForm writes created, edited and deleted items to the shared cache itself.
  const editor = useCatalogueEditor<Item>();
  // One Acquire dialog for the page, on the row whose Acquire was pressed (PERF-48).
  const [acquiring, setAcquiring] = useState<{ row: ItemRow; open: boolean } | null>(null);
  const acquiringRow = acquiring
    ? (filters.rows.find((row) => row._rowId === acquiring.row._rowId) ?? acquiring.row)
    : null;

  const capabilities = campaignCapabilities(campaign);
  const canEdit = capabilities.edit_catalogue;

  const handleLoadoutTabChange = (tabId: LoadoutTabId) => {
    if (!id) {
      return;
    }
    navigate(`/campaigns/${id}/${tabId}`);
  };

  const columns = itemColumns(filters.activeTab, {
    propertyMap,
    actions: (item) => (
      <div
        className="flex items-center justify-end gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        {item.bestiary_entry ? (
          <Tooltip
            trigger={
              <button
                type="button"
                aria-label="View bestiary entry"
                onClick={() =>
                  navigate(`/campaigns/${id}/bestiary?entry=${item.bestiary_entry!.id}`)
                }
                className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition hover:text-foreground"
              >
                Bestiary
              </button>
            }
            content="View bestiary entry"
          />
        ) : null}
        <BuyItemButton
          item={item}
          aria-haspopup="dialog"
          aria-expanded={Boolean(acquiring?.open && acquiring.row._rowId === item._rowId)}
          onClick={() => setAcquiring({ row: item, open: true })}
        />
        {/* Every item: a book item's edit makes the campaign's version (CAT-TWEAK-01), and a
            house rule's clone detaches from its rule. */}
        {canEdit ? <EditRowButton label="Edit item" onClick={() => editor.edit(item)} /> : null}
      </div>
    ),
  });

  return (
    <div className="min-h-0 flex h-full flex-col gap-4 sm:gap-8">
      <PageHeader
        title="Wargear"
        subtitle="Weapons, armour and equipment"
        tabs={itemTabs}
        activeTab={filters.activeTab}
        onTabChange={(tabId) => filters.setActiveTab(tabId as ItemTabId)}
      />

      {isMobile ? (
        <MobileTabs
          tabs={LOADOUT_TABS}
          activeTab="items"
          onTabChange={handleLoadoutTabChange}
          className="mt-2"
          showDivider
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 sm:gap-4 sm:px-0">
        {isMobile ? (
          <MobileTabs
            tabs={itemTabs}
            activeTab={filters.activeTab}
            onTabChange={(tabId) => filters.setActiveTab(tabId as ItemTabId)}
            className="-ml-2"
          />
        ) : null}
        <ItemsFilterBar filters={filters}>
          {canEdit && !editor.isOpen ? (
            <Button size="sm" className="ml-auto md:h-11" onClick={editor.openNew}>
              Add item
            </Button>
          ) : null}
        </ItemsFilterBar>
        {editor.isOpen && (
          <div ref={editor.formRef}>
            <AddItemForm
              campaignId={campaignId}
              onCreated={editor.close}
              onUpdated={editor.close}
              onDeleted={(itemId) => {
                filters.collapseItem(itemId);
                editor.close();
              }}
              onCancel={editor.close}
              editingItem={editor.editing}
              canDelete={capabilities.delete_catalogue}
            />
          </div>
        )}
        <div className="flex flex-1 min-h-0 flex-col gap-4">
          {isLoading ? (
            <TableSkeleton columns={9} rows={12} />
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filters.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gear found.</p>
          ) : (
            <>
              {propertyError ? (
                <p className="px-4 py-2 text-xs text-red-500">{propertyError}</p>
              ) : null}
              <CatalogueTable
                rows={filters.rows}
                columns={columns}
                getRowId={(item) => item._rowId}
                isMobile={isMobile}
                mobile={itemsMobileLayout(columns, subtitle)}
                desktopDetails={description}
                stickyHeader
                expanded={filters.expanded}
              />
            </>
          )}
        </div>
      </div>
      {acquiringRow ? (
        <AcquireItemDialog
          key={acquiringRow._rowId}
          item={acquiringRow}
          initialAvailabilityId={acquiringRow._availability?.id ?? null}
          open={acquiring?.open ?? false}
          onOpenChange={(open) => setAcquiring((prev) => (prev ? { ...prev, open } : prev))}
          trigger={null}
        />
      ) : null}
    </div>
  );
}
