import { useState } from "react";
import type { ReactNode } from "react";

import CollapsibleSection from "@/components/ui/collapsible-section";
import { BeastKindLabel } from "@/features/bestiary/components/BeastKindIcon";
import { EntryBadge } from "@/features/catalogue/components/EntryBadge";
import type {
  CatalogueColumn,
  CatalogueMobileLayout,
} from "@/features/catalogue/components/CatalogueTable";

import { formatCost, formatRarity, formatRestrictions } from "../utils/availability-format";
import { AnimalStatsCell, PropertiesCell, SpecialsCell } from "./item-cells";

import type { Item, ItemAvailability, ItemProperty } from "../types/item-types";

/** A Wargear row: one item with one of its availabilities. */
export type ItemRow = Item & {
  _availability: ItemAvailability | null;
  _rowId: string;
};

export type ItemTabId = "weapons" | "armour" | "misc" | "animals";

type ItemColumn = CatalogueColumn<ItemRow>;

const HIDE_BELOW_LG = "hidden lg:table-cell";
const HIDE_BELOW_XL = "hidden xl:table-cell";
const HIDE_BELOW_2XL = "hidden 2xl:table-cell";

const muted = (text: ReactNode) => <span className="text-muted-foreground">{text}</span>;

/** A column `width` wide, hidden on narrower desktops when `hide` says so. */
const column = (
  key: string,
  label: string,
  width: string,
  render: ItemColumn["render"],
  hide?: string
): ItemColumn => ({
  key,
  label,
  headerClassName: hide ? `${width} ${hide}` : width,
  cellClassName: hide,
  render,
});

const name = (width: string) =>
  column("name", "Name", width, (item) => (
    <span className="font-medium text-foreground">
      {item.name}
      <EntryBadge entry={item} />
    </span>
  ));
const subtype = (width: string) =>
  column("subtype", "Type", width, (item) => muted(item.subtype || "-"), HIDE_BELOW_LG);
/** An Animal item's kind, its beast's (Mount, Pet, Creature) with the kind's mark. */
const kind = (width: string) =>
  column("kind", "Kind", width, (item) =>
    item.bestiary_entry ? (
      <BeastKindLabel kind={item.bestiary_entry.kind} className="text-xs" />
    ) : (
      muted(item.subtype || "-")
    )
  );
const restricted = (width: string) =>
  column("restricted", "Restricted to", width, (item) =>
    muted(formatRestrictions(item._availability))
  );
const rarity = (width: string) =>
  column("rarity", "Rarity", width, (item) => muted(formatRarity(item._availability?.rarity)));
const price = (width: string) =>
  column("price", "Price", width, (item) => muted(formatCost(item._availability?.cost)));
const grade = column(
  "grade",
  "Grade",
  "w-[6%]",
  (item) => muted(item.grade || "-"),
  HIDE_BELOW_2XL
);

type ItemColumnsOptions = {
  /** Every property's text, from the cached list. */
  propertyMap: Record<number, ItemProperty>;
  /** The row's buttons: Bestiary, Acquire, Edit. */
  actions: (item: ItemRow) => ReactNode;
};

/** The Wargear table's columns for one tab, then the row's buttons. */
export function itemColumns(tab: ItemTabId, { propertyMap, actions }: ItemColumnsOptions) {
  const properties = (width: string) =>
    column(
      "properties",
      "Properties",
      width,
      (item) => <PropertiesCell item={item} propertyMap={propertyMap} />,
      HIDE_BELOW_XL
    );
  const byTab: Record<ItemTabId, ItemColumn[]> = {
    weapons: [
      name("w-[22%]"),
      subtype("w-[10%]"),
      column("strength", "Strength", "w-[10%]", (item) => muted(item.strength || "As user")),
      column("range", "Range", "w-[12%]", (item) => muted(item.range || "Close combat")),
      properties("w-[18%]"),
      restricted("w-[10%]"),
      rarity("w-[6%]"),
      price("w-[6%]"),
      grade,
    ],
    armour: [
      name("w-[24%]"),
      column("save", "Save", "w-[10%]", (item) => muted(item.save || "-")),
      properties("w-[22%]"),
      restricted("w-[12%]"),
      rarity("w-[8%]"),
      price("w-[8%]"),
      grade,
    ],
    misc: [
      name("w-[26%]"),
      properties("w-[24%]"),
      column("singleUse", "Single use", "w-[10%]", (item) => muted(item.single_use ? "Yes" : "-")),
      restricted("w-[12%]"),
      rarity("w-[8%]"),
      price("w-[8%]"),
      grade,
    ],
    animals: [
      name("w-[16%]"),
      kind("w-[8%]"),
      column(
        "statblock",
        "Stats",
        "w-[26%]",
        (item) => <AnimalStatsCell item={item} />,
        HIDE_BELOW_XL
      ),
      column(
        "specials",
        "Special Rules",
        "w-[18%]",
        (item) => <SpecialsCell item={item} />,
        HIDE_BELOW_XL
      ),
      restricted("w-[10%]"),
      rarity("w-[6%]"),
      price("w-[6%]"),
      grade,
    ],
  };
  return [
    ...byTab[tab],
    {
      key: "buttons",
      label: "",
      headerClassName: "w-[6%]",
      cellClassName: "whitespace-nowrap",
      render: actions,
    },
  ];
}

function DescriptionCollapsible({ description }: { description?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <CollapsibleSection title="Description" collapsed={!open} onToggle={() => setOpen((o) => !o)}>
      <p className="text-xs text-muted-foreground">
        {description?.trim() || "No description available."}
      </p>
    </CollapsibleSection>
  );
}

/**
 * Wargear on a phone: the name with the row's availability under it ("Forest Goblins ·
 * Common", CAT-UX-03), the price and the buttons; the row opens to the other columns and the
 * description.
 */
export function itemsMobileLayout(
  columns: ItemColumn[],
  subtitle: (item: ItemRow) => string
): CatalogueMobileLayout<ItemRow> {
  const find = (key: string) => columns.find((entry) => entry.key === key);
  const nameColumn = find("name");
  const priceColumn = find("price");
  const buttonsColumn = find("buttons");
  const detailColumns = columns.filter(
    (entry) => !["name", "price", "buttons"].includes(entry.key) && entry.label.trim().length > 0
  );
  return {
    name: (item) => (
      <>
        {nameColumn?.render(item) ?? item.name}
        <span className="block text-[0.65rem] font-normal text-muted-foreground">
          {subtitle(item)}
        </span>
      </>
    ),
    second: {
      label: "Price",
      className: "w-[18%]",
      render: (item) => priceColumn?.render(item) ?? "-",
    },
    actions: (item) => buttonsColumn?.render(item),
    details: (item) => (
      <div className="flex flex-col gap-3">
        {detailColumns.map((entry) => (
          <div key={entry.key} className="flex gap-2 text-sm">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{entry.label}</span>
            <span>{entry.render(item)}</span>
          </div>
        ))}
        <DescriptionCollapsible description={item.description} />
      </div>
    ),
  };
}
