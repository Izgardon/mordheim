import { useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import ReferencePage from "@/features/reference/ReferencePage";
import {
  DetailSection,
  FactLine,
  Flavour,
  ReferenceDetail,
  RuleBlock,
  TagList,
} from "@/features/reference/ReferenceDetail";
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
import { ProfileStrip } from "@/features/reference/profile";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useWarbandSheet } from "@/features/warbands/hooks/warband/useWarbandSheet";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import ItemFormDialog from "../components/ItemFormDialog";
import StorePanel, { type StoreOpening } from "../store/StorePanel";
import {
  STORE_CATEGORIES,
  allows,
  isCommon,
  kindOf,
  offerFor,
  priceLabel,
  rarityLabel,
  storeCategory,
  type Buyer,
  type StoreCategory,
} from "../store/store-items";
import type { Item, ItemAvailability, ItemProperty } from "../types/item-types";
import { formatRestrictions } from "../utils/availability-format";
import { beastEditLink, beastOf, isSold } from "../utils/item-listing";

const COLUMNS = [
  { label: "Type", className: "w-[150px] shrink-0" },
  { label: "Price", className: "w-[124px] shrink-0" },
  { label: "Rarity", className: "w-[96px] shrink-0" },
  { label: "Rules", className: "w-[240px] shrink-0 max-[1180px]:hidden" },
];

/** "S as user +1", "30\" · S 4", "Save 6+": an item's figures in one line. */
function statOf(item: Item) {
  const parts: string[] = [];
  if (item.range && !/close/i.test(item.range)) parts.push(item.range);
  if (item.strength) parts.push(`S ${item.strength.replace(/^As user/i, "as user")}`);
  if (item.save) parts.push(`Save ${item.save}`);
  return parts.join(" · ");
}

/** The commonest price of an item, for a reader with no warband (no restriction applies). */
const commonest = (item: Item) =>
  [...(item.availabilities ?? [])].sort((a, b) => a.rarity - b.rarity || a.cost - b.cost)[0] ??
  null;

/** Who an availability is for: "For everyone", or its restrictions with their notes. */
const whoLine = (availability: ItemAvailability) =>
  availability.restrictions?.length ? `For ${formatRestrictions(availability)}` : "For everyone";

/** A rule chip: "Own rule" for the rule an item carries under its own name (Lucky Charm). */
const ruleChip = (item: Item, rule: string) =>
  rule.trim().toLowerCase() === item.name.trim().toLowerCase() ? "Own rule" : rule;

type Row = { item: Item; availability: ItemAvailability | null; warning: string };

/**
 * Wargear (design E, E-Web-Items and E-Mobile-Items): every item of the campaign, searched by name
 * or rule, "What <your warband> can buy" on by default (the store's restriction logic: off shows the
 * restricted items with their short warning), the store's category chips, and rows with name,
 * kind, price and Common or Rare N. An open row shows its rules, who can buy it and Get this item,
 * which opens the store's acquire panel and basket for your warband with the item's row open.
 * Custom items are added and edited behind plain buttons, as today.
 */
export default function Wargear() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const items = useCatalogue("items", campaignId);
  const properties = useCatalogue("item-properties", campaignId);
  const sheet = useWarbandSheet({ campaignId, hasCampaignId: Boolean(id), warbandId: null });
  const { warband } = sheet;
  // The list waits for your warband too, so restricted items never flash in before it is known.
  const loading = items.isLoading || sheet.isLoading;
  const params = useReferenceParams(!loading);
  const [onlyMine, setOnlyMine] = useState(true);
  const [category, setCategory] = useState<StoreCategory>("all");
  const [getting, setGetting] = useState<StoreOpening["again"]>(null);
  const capabilities = campaignCapabilities(campaign);
  const canBuy = Boolean(warband) && sheet.capabilities.manage_items;

  const buyer = useMemo<Buyer | null>(
    () => (warband ? { faction: warband.faction, restrictions: warband.restrictions } : null),
    [warband]
  );
  const propertyText = useMemo(
    () => new Map<number, ItemProperty>(properties.data.map((property) => [property.id, property])),
    [properties.data]
  );
  const all = useMemo<Row[]>(
    () =>
      [...items.data]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) =>
          buyer
            ? { item, ...offerFor(item, buyer) }
            : { item, availability: commonest(item), warning: "" }
        ),
    [buyer, items.data]
  );
  const searched = all.filter(
    ({ item, warning }) =>
      (!buyer || !onlyMine || !warning) &&
      matchesSearchQuery(
        params.query,
        item.name,
        item.subtype,
        item.type,
        ...(item.properties ?? []).map((property) => property.name)
      )
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
  const restricted = rows.filter((row) => row.warning).length;
  const summary = `${rows.length} ${rows.length === 1 ? "item" : "items"} shown${
    !buyer
      ? ""
      : onlyMine
        ? `, what ${warband?.name} can buy`
        : restricted
          ? `, ${restricted} restricted`
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

  const detail = ({ item, availability, warning }: Row) => {
    const beast = beastOf(item);
    const facts = [
      ...(item.range ? [{ label: "Range", value: item.range }] : []),
      ...(item.strength ? [{ label: "Strength", value: item.strength }] : []),
      ...(item.save ? [{ label: "Save", value: item.save }] : []),
      ...(availability ? [{ label: "Cost", value: priceLabel(availability) }] : []),
      ...(availability ? [{ label: "Rarity", value: rarityLabel(availability.rarity) }] : []),
    ];
    const rules = item.properties ?? [];
    const profile = beast?.has_profile ? beast : null;
    const aside = (
      <>
        {canBuy && availability && isSold(item) ? (
          <Button
            className="min-h-11 w-full"
            onClick={() => setGetting({ itemId: item.id, name: item.name, price: null })}
          >
            Get this item
          </Button>
        ) : null}
        <DetailSection title="Who can buy">
          {item.availabilities?.length ? (
            item.availabilities.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-0.5 border border-border bg-surface px-2.5 py-2"
              >
                <div className="flex justify-between gap-2.5">
                  <span className="font-mono text-[13px] font-bold text-ink">
                    {priceLabel(entry)}
                  </span>
                  <span className="text-[13px] font-semibold text-text2">
                    {rarityLabel(entry.rarity)}
                  </span>
                </div>
                <span className="text-xs text-text2">{whoLine(entry)}</span>
              </div>
            ))
          ) : (
            <span className="text-[13px] text-text2">Not sold.</span>
          )}
          {buyer ? (
            <TagList
              tags={(item.availabilities ?? [])
                .flatMap((entry) => entry.restrictions ?? [])
                .filter(
                  (link, index, links) =>
                    links.findIndex((other) => other.restriction.id === link.restriction.id) ===
                    index
                )
                .map((link) => ({
                  label: link.restriction.restriction,
                  mine: allows(link.restriction, buyer),
                }))}
            />
          ) : null}
        </DetailSection>
        {item.grade ? (
          <DetailSection title="Source">
            <span className="text-[13px] text-ink">Grade {item.grade}</span>
          </DetailSection>
        ) : null}
        {capabilities.edit_catalogue ? (
          beast ? (
            <Link
              to={beastEditLink(campaignId, beast.id)}
              className="text-[13px] font-semibold text-accent-text hover:text-accent-hi"
            >
              Edit {beast.name} in the Bestiary
            </Link>
          ) : (
            <ItemFormDialog
              mode="edit"
              item={item}
              campaignId={campaignId}
              canDelete={capabilities.delete_catalogue}
              onUpdated={(saved) => params.set({ open: String(saved.id) })}
              onDeleted={() => params.close()}
              trigger={
                <Button variant="secondary" className="min-h-10 self-start">
                  Edit item
                </Button>
              }
            />
          )
        ) : null}
      </>
    );
    return (
      <ReferenceDetail title={item.name} kind={kindOf(item)} isMobile={isMobile} aside={aside}>
        {warning ? (
          <div className="self-start border border-dashed border-danger-line px-2.5 py-1.5 text-[13px] text-danger">
            {warning}
          </div>
        ) : null}
        {item.description?.trim() ? <Flavour>{item.description}</Flavour> : null}
        {isMobile ? null : <FactLine facts={facts} />}
        {profile ? <ProfileStrip profile={profile} /> : null}
        {rules.length || beast?.specials?.length ? (
          <div className="flex flex-col gap-2.5">
            {rules.map((rule) => (
              <RuleBlock key={rule.id} name={rule.name}>
                {propertyText.get(rule.id)?.description}
              </RuleBlock>
            ))}
            {(beast?.specials ?? []).map((special) => (
              <RuleBlock key={`special-${special.id}`} name={special.name}>
                {special.description}
              </RuleBlock>
            ))}
          </div>
        ) : null}
      </ReferenceDetail>
    );
  };

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
          buyer && onlyMine
            ? `No items match. Try another word, or turn off What ${warband?.name} can buy.`
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
              name={item.name}
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
                        {(item.properties ?? []).slice(0, 4).map((rule) => (
                          <span
                            key={rule.id}
                            className="border border-border px-[7px] py-0.5 text-xs font-semibold"
                          >
                            {ruleChip(item, rule.name)}
                          </span>
                        ))}
                      </span>,
                    ]
              }
            >
              {detail(row)}
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
