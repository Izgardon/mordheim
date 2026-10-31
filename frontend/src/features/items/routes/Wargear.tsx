import { useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import ReferencePage from "@/features/reference/ReferencePage";
import {
  BuyableToggle,
  FilterRow,
  ReferenceChips,
  ReferenceSearch,
} from "@/features/reference/ReferenceFilters";
import { ReferenceList, ShowMore, useShownRows } from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useWarbandSheet } from "@/features/warbands/hooks/warband/useWarbandSheet";
import { useCatalogue } from "@/lib/catalogue-queries";
import { useMediaQuery } from "@/lib/use-media-query";

import { useWhoCan } from "../api/who-can-queries";
import ItemFormDialog from "../components/ItemFormDialog";
import StorePanel, { type StoreOpening } from "../store/StorePanel";
import type { StoreCategory } from "../store/store-items";
import WargearDetail from "./WargearDetail";
import WargearRow, { WARGEAR_COLUMNS } from "./WargearRow";
import { ALL_SETTINGS, useWargearRows } from "./wargear-rows";

/**
 * Wargear (design E, the items rebuild): every item of the campaign, searched by name, rule or
 * search word, filtered by kind and by setting, "What <your warband> can buy" on by default (the
 * server's who-can/: each item's price row for the warband and why it can't usually buy one; off
 * shows the rest greyed with that reason). An open row is the item's card, with Get this item.
 */
export default function Wargear() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const items = useCatalogue("items", campaignId);
  const settings = useSettingsById();
  const sheet = useWarbandSheet({ campaignId, hasCampaignId: Boolean(id), warbandId: null });
  const { warband } = sheet;
  const whoCan = useWhoCan(campaignId, warband?.id);
  // The list waits for your warband's offers too, so restricted items never flash in first.
  const loading = items.isLoading || sheet.isLoading || whoCan.isLoading;
  const params = useReferenceParams(!loading);
  const [onlyMine, setOnlyMine] = useState(true);
  const [category, setCategory] = useState<StoreCategory>("all");
  const [setting, setSetting] = useState(ALL_SETTINGS);
  const [getting, setGetting] = useState<StoreOpening["again"]>(null);
  const capabilities = campaignCapabilities(campaign);
  const canBuy = Boolean(warband) && sheet.capabilities.manage_items;
  const { rows, counts, settingOptions, summary } = useWargearRows({
    items: items.data,
    settings,
    offers: warband ? whoCan.items : null,
    warbandName: warband?.name ?? null,
    onlyMine,
    query: params.query,
    category,
    setting,
    openId: params.openId,
  });
  const openIndex = rows.findIndex((row) => String(row.item.id) === params.openId);
  const shown = useShownRows(rows, openIndex);

  const addButton = capabilities.edit_catalogue ? (
    <ItemFormDialog
      mode="create"
      campaignId={campaignId}
      onCreated={(item) => params.set({ open: String(item.id), q: null })}
      trigger={
        <Button variant="secondary" className={isMobile ? "min-h-10" : undefined}>
          Add item
        </Button>
      }
    />
  ) : null;

  return (
    <ReferencePage
      title="Wargear"
      section="items"
      archived={{
        kind: "items",
        campaignId,
        canRestore: capabilities.edit_catalogue,
        noun: "wargear",
      }}
      actions={addButton}
      filters={
        <>
          <FilterRow isMobile={isMobile}>
            <ReferenceSearch
              value={params.query}
              onChange={params.setQuery}
              placeholder={
                isMobile ? "Name, rule or nickname" : "Name, kind or rule: parry finds Sword"
              }
              label="Search wargear"
              isMobile={isMobile}
            />
            {warband ? (
              <BuyableToggle
                warbandName={warband.name}
                checked={onlyMine}
                onChange={setOnlyMine}
                isMobile={isMobile}
              />
            ) : null}
          </FilterRow>
          <ReferenceChips
            label="Type"
            options={counts}
            value={category}
            onChange={setCategory}
            isMobile={isMobile}
          />
          <ReferenceChips
            label="Setting"
            options={settingOptions}
            value={setting}
            onChange={setSetting}
            isMobile={isMobile}
          />
        </>
      }
      summary={isMobile ? undefined : summary}
    >
      {items.error ? <p className="m-0 text-sm text-danger">{items.error}</p> : null}
      <ReferenceList
        nameLabel="Item"
        columns={isMobile ? undefined : WARGEAR_COLUMNS}
        isEmpty={!loading && rows.length === 0}
        empty={
          warband && onlyMine
            ? `No items match. Try another word, or turn off What ${warband.name} can buy.`
            : "No items match. Try another word."
        }
      >
        {loading ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Opening the armoury…</li>
        ) : null}
        {(loading ? [] : shown.rows).map((row) => {
          const { item, warning } = row;
          const key = String(item.id);
          return (
            <WargearRow
              key={key}
              row={row}
              isMobile={isMobile}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
            >
              <WargearDetail
                item={item}
                offer={row.offer}
                warning={warning}
                setting={item.setting_id != null ? settings.get(item.setting_id) : undefined}
                campaignId={campaignId}
                isMobile={isMobile}
                canBuy={canBuy}
                canEdit={capabilities.edit_catalogue}
                canDelete={capabilities.delete_catalogue}
                onGet={() => setGetting({ itemId: item.id, name: item.name, price: null })}
                onSaved={(saved) => params.set({ open: String(saved.id) })}
                onDeleted={() => params.close()}
              />
            </WargearRow>
          );
        })}
      </ReferenceList>
      {rows.length > 0 ? (
        <ShowMore
          shown={shown.rows.length}
          total={rows.length}
          onMore={shown.showMore}
          sorted="sorted by name"
        />
      ) : null}
      {warband && canBuy ? (
        <StorePanel
          open={getting !== null}
          onOpenChange={(open) => (open ? null : setGetting(null))}
          campaignId={campaignId}
          warband={warband}
          heroes={sheet.heroes}
          henchmenGroups={sheet.henchmenGroups}
          hirelings={sheet.hirelings}
          canBuy={canBuy}
          opening={{ again: getting }}
        />
      ) : null}
    </ReferencePage>
  );
}
