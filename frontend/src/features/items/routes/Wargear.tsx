import { useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { outOfPlay, useSettingsById } from "@/features/campaigns/api/settings-queries";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import ReferencePage from "@/features/reference/ReferencePage";
import {
  BuyableToggle,
  FilterRow,
  ReferenceChips,
  ReferenceSearch,
} from "@/features/reference/ReferenceFilters";
import {
  PriceRarity,
  ReferenceList,
  ReferenceRow,
  ShowMore,
  useShownRows,
} from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useWarbandSheet } from "@/features/warbands/hooks/warband/useWarbandSheet";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import { useWhoCan } from "../api/who-can-queries";
import ItemFormDialog from "../components/ItemFormDialog";
import StorePanel, { type StoreOpening } from "../store/StorePanel";
import {
  STORE_CATEGORIES,
  itemName,
  kindOf,
  searchWords,
  storeCategory,
  type StoreCategory,
} from "../store/store-items";
import type { Item, ItemAvailability, ItemOffer } from "../types/item-types";
import { isCommon, priceLabel, rarityLabel } from "../utils/item-prices";
import WargearDetail from "./WargearDetail";

const COLUMNS = [
  { label: "Type", className: "w-[150px] shrink-0" },
  { label: "Price", className: "w-[124px] shrink-0" },
  { label: "Rarity", className: "w-[96px] shrink-0" },
  { label: "Rules", className: "w-[240px] shrink-0 max-[1180px]:hidden" },
];
const ALL_SETTINGS = "all";

/** "S as user +1", "30\" · S 4", "Save 6+": an item's figures in one line. */
function statOf(item: Item) {
  const parts: string[] = [];
  if (item.range && !/close/i.test(item.range)) parts.push(item.range);
  if (item.strength) parts.push(`S ${item.strength.replace(/^As user/i, "as user")}`);
  if (item.save) parts.push(`Save ${item.save}`);
  return parts.join(" · ");
}

type Row = {
  item: Item;
  availability: ItemAvailability | null;
  offer?: ItemOffer;
  warning: string;
};

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

  const all = useMemo<Row[]>(
    () =>
      [...items.data]
        .sort((a, b) => itemName(a).localeCompare(itemName(b)))
        .map((item) => {
          const offer = warband ? whoCan.items.get(item.id) : undefined;
          const rows = item.availabilities ?? [];
          const availability =
            rows.find((row) => row.id === offer?.availability_id) ?? rows[0] ?? null;
          const warning = warband
            ? offer && !offer.can_buy
              ? offer.reason
              : ""
            : outOfPlay(item, settings);
          return { item, availability, offer, warning };
        }),
    [items.data, settings, warband, whoCan.items]
  );
  const settingKey = (item: Item) => (item.setting_id == null ? "own" : String(item.setting_id));
  const searched = all.filter(
    ({ item, warning }) =>
      (!warband || !onlyMine || !warning) &&
      (setting === ALL_SETTINGS || settingKey(item) === setting) &&
      matchesSearchQuery(params.query, ...searchWords(item))
  );
  const rows = all.filter(
    (row) =>
      String(row.item.id) === params.openId ||
      (searched.includes(row) && (category === "all" || storeCategory(row.item) === category))
  );
  const openIndex = rows.findIndex((row) => String(row.item.id) === params.openId);
  const shown = useShownRows(rows, openIndex);
  const counts = STORE_CATEGORIES.map((entry) => ({
    ...entry,
    count:
      entry.id === "all"
        ? searched.length
        : searched.filter((row) => storeCategory(row.item) === entry.id).length,
  }));
  const settingOptions = [
    { id: ALL_SETTINGS, label: "All settings" },
    ...[...new Set(items.data.map(settingKey))]
      .map((key) => ({
        id: key,
        label: key === "own" ? "This campaign" : (settings.get(Number(key))?.name ?? "Unknown"),
        order: key === "own" ? 999 : (settings.get(Number(key))?.sort_order ?? 998),
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ id: key, label }) => ({ id: key, label })),
  ];
  const restricted = rows.filter((row) => row.warning).length;
  const summary = `${rows.length} ${rows.length === 1 ? "item" : "items"} shown${
    !warband
      ? ""
      : onlyMine
        ? `, what ${warband.name} can buy`
        : restricted
          ? `, ${restricted} not usually`
          : ""
  }`;

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
        columns={isMobile ? undefined : COLUMNS}
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
          const { item, availability, warning } = row;
          const key = String(item.id);
          const price = priceLabel(availability);
          const rarity = availability ? rarityLabel(availability.rarity) : "-";
          const rare = Boolean(availability && !isCommon(availability.rarity));
          const stat = statOf(item);
          return (
            <ReferenceRow
              key={key}
              id={key}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
              name={itemName(item)}
              sub={isMobile ? [kindOf(item), stat].filter(Boolean).join(" · ") : undefined}
              warn={warning}
              dim={Boolean(warning)}
              aside={<PriceRarity price={price} rarity={rarity} rare={rare} />}
              cells={
                isMobile
                  ? undefined
                  : [
                      <>
                        <span>{kindOf(item)}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{stat}</span>
                      </>,
                      <span key="price" className="font-mono font-bold text-ink">
                        {price}
                      </span>,
                      <span key="rarity" className={rare ? "font-semibold text-accent-text" : ""}>
                        {rarity}
                      </span>,
                      <span key="rules" className="flex flex-row flex-wrap gap-1">
                        {(item.rules ?? [])
                          .filter((rule) => rule.name)
                          .slice(0, 4)
                          .map((rule) => (
                            <span
                              key={rule.id}
                              className="border border-border px-[7px] py-0.5 text-xs font-semibold"
                            >
                              {rule.name}
                            </span>
                          ))}
                      </span>,
                    ]
              }
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
            </ReferenceRow>
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
