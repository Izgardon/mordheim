import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// components
import { Input } from "@components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import { ScrollArea } from "@components/scroll-area";
import TabbedCard from "@components/tabbed-card";
import { Tooltip } from "@components/tooltip";
import CreateItemDialog from "../components/CreateItemDialog";
import EditItemDialog from "../components/EditItemDialog";
import BuyItemDialog from "../components/BuyItemDialog";

// utils
import { renderBoldMarkdown } from "../../../lib/render-bold-markdown";

// api
import { listItems, listItemProperties } from "../api/items-api";
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";

// types
import type { Item, ItemProperty } from "../types/item-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

const ALL_SUBTYPES = "all";
const ALL_SINGLE_USE = "all";
const SINGLE_USE_ONLY = "single";
const STAT_HEADERS = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;

const formatRarity = (value?: number | null) => {
  if (value === 2) {
    return "Common";
  }
  if (value === null || value === undefined) {
    return "�";
  }
  return String(value);
};
const formatCost = (value?: number | null) => {
  if (value === null || value === undefined) {
    return "-";
  }
  return String(value);
};

type ItemTabId = "weapons" | "armour" | "misc" | "animals";

const itemTabs: ReadonlyArray<{ id: ItemTabId; label: string }> = [
  { id: "weapons", label: "Weapons" },
  { id: "armour", label: "Armour" },
  { id: "misc", label: "Miscellaneous" },
  { id: "animals", label: "Animals" },
];

const itemTypeByTab: Record<ItemTabId, string> = {
  weapons: "Weapon",
  armour: "Armour",
  misc: "Miscellaneous",
  animals: "Animal",
};

const subtypeOptionsByType: Record<string, string[]> = {
  Weapon: ["Melee", "Ranged", "Blackpowder"],
  Armour: ["Armour", "Shield", "Helmet", "Barding"],
  Animal: ["Mount", "Attack"],
};

type ColumnConfig = {
  key: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (item: Item) => ReactNode;
};

const parseStatblock = (statblock: string) => {
  try {
    return JSON.parse(statblock) as Record<string, string | number>;
  } catch {
    try {
      const normalized = statblock
        .replace(/'/g, "\"")
        .replace(/([,{]\s*)([A-Za-z]+)(\s*:)/g, '$1"$2"$3');
      return JSON.parse(normalized) as Record<string, string | number>;
    } catch {
      return null;
    }
  }
};

const renderStatblock = (statblock?: string | null) => {
  if (!statblock) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (statblock.includes("[[table]]")) {
    return <div className="text-xs text-muted-foreground">{renderBoldMarkdown(statblock)}</div>;
  }

  try {
    const parsed = parseStatblock(statblock);
    if (!parsed) {
      return <span className="text-xs text-muted-foreground">{statblock}</span>;
    }
    const values = STAT_HEADERS.map((key) => parsed?.[key]);
    if (values.every((value) => value === undefined || value === null || value === "")) {
      return <span className="text-muted-foreground">-</span>;
    }
    return (
      <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/60">
        <table className="min-w-full text-[10px] text-muted-foreground">
          <thead className="bg-background/80 uppercase tracking-[0.2em]">
            <tr>
              {STAT_HEADERS.map((header) => (
                <th key={header} className="px-2 py-1 text-left font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/60">
              {values.map((value, index) => (
                <td
                  key={`${STAT_HEADERS[index]}-${index}`}
                  className="px-2 py-1 text-xs font-semibold text-foreground"
                >
                  {value ?? "-"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  } catch {
    return <span className="text-xs text-muted-foreground">{statblock}</span>;
  }
};

export default function Items() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [items, setItems] = useState<Item[]>([]);
  const [propertyMap, setPropertyMap] = useState<Record<number, ItemProperty>>({});
  const [activeTab, setActiveTab] = useState<ItemTabId>("weapons");
  const [selectedSubtype, setSelectedSubtype] = useState(ALL_SUBTYPES);
  const [selectedSingleUse, setSelectedSingleUse] = useState(ALL_SINGLE_USE);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [propertyError, setPropertyError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);

  const canAdd =
    campaign?.role === "owner" ||
    campaign?.role === "admin" ||
    memberPermissions.includes("add_items");
  const canManage =
    campaign?.role === "owner" ||
    campaign?.role === "admin" ||
    memberPermissions.includes("manage_items");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const campaignId = Number(id);
    listItems(Number.isNaN(campaignId) ? {} : { campaignId })
      .then((data) => setItems(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load items");
        } else {
          setError("Unable to load items");
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    setPropertyError("");
    const campaignId = Number(id);
    listItemProperties(Number.isNaN(campaignId) ? {} : { campaignId })
      .then((properties) => {
        const mapped = properties.reduce<Record<number, ItemProperty>>((acc, property) => {
          acc[property.id] = property;
          return acc;
        }, {});
        setPropertyMap(mapped);
      })
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setPropertyError(errorResponse.message || "Unable to load item properties");
        } else {
          setPropertyError("Unable to load item properties");
        }
      });
  }, [id]);

  useEffect(() => {
    if (campaign?.role !== "player" || !id) {
      return;
    }

    const campaignId = Number(id);
    if (Number.isNaN(campaignId)) {
      return;
    }

    listMyCampaignPermissions(campaignId)
      .then((permissions) => setMemberPermissions(permissions.map((permission) => permission.code)))
      .catch(() => setMemberPermissions([]));
  }, [campaign?.role, id]);

  useEffect(() => {
    setSelectedSubtype(ALL_SUBTYPES);
    setSelectedSingleUse(ALL_SINGLE_USE);
  }, [activeTab]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => {
      const haystack = [
        item.name,
        item.type,
        item.subtype,
        item.unique_to,
        item.description,
        item.properties?.map((property) => property.name).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, searchQuery]);

  const tabItems = useMemo(() => {
    const type = itemTypeByTab[activeTab];
    const byType = filteredItems.filter((item) => item.type === type);
    if (selectedSubtype === ALL_SUBTYPES || !selectedSubtype.trim()) {
      if (activeTab !== "misc" || selectedSingleUse === ALL_SINGLE_USE) {
        return byType;
      }
      return byType.filter((item) => item.single_use);
    }
    const subtypeFiltered = byType.filter(
      (item) => (item.subtype ?? "").toLowerCase() === selectedSubtype.toLowerCase()
    );
    if (activeTab !== "misc" || selectedSingleUse === ALL_SINGLE_USE) {
      return subtypeFiltered;
    }
    return subtypeFiltered.filter((item) => item.single_use);
  }, [filteredItems, activeTab, selectedSubtype, selectedSingleUse]);

  const subtypeOptions = useMemo(() => {
    const type = itemTypeByTab[activeTab];
    const defaults = subtypeOptionsByType[type] ?? [];
    const extras = items
      .filter((item) => item.type === type)
      .map((item) => item.subtype)
      .filter(Boolean) as string[];
    const unique = new Set([...defaults, ...extras]);
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [items, activeTab]);

  const handleCreated = (newItem: Item) => {
    setItems((prev) => [newItem, ...prev]);
  };

  const handleUpdated = (updatedItem: Item) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  };

  const handleDeleted = (itemId: number) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const columns = useMemo<ColumnConfig[]>(() => {
    const propertiesCell = (item: Item) => {
      if (!item.properties || item.properties.length === 0) {
        return <span className="text-muted-foreground">-</span>;
      }
      return (
        <div className="flex flex-wrap gap-2">
          {item.properties.map((property) => (
            <Tooltip
              key={property.id}
              trigger={
                <span className="text-xs font-semibold text-muted-foreground underline decoration-dotted underline-offset-2 transition hover:text-foreground">
                  {property.name}
                </span>
              }
              content={
                propertyMap[property.id]?.description?.trim()
                  ? propertyMap[property.id]?.description
                  : "No description available yet."
              }
              className="inline-flex"
            />
          ))}
        </div>
      );
    };

    const baseColumns: Record<ItemTabId, ColumnConfig[]> = {
      weapons: [
        {
          key: "name",
          label: "Name",
          headerClassName: "w-[18%]",
          render: (item) => <span className="font-medium text-foreground">{item.name}</span>,
        },
        {
          key: "subtype",
          label: "Type",
          headerClassName: "w-[12%]",
          render: (item) => <span className="text-muted-foreground">{item.subtype || "-"}</span>,
        },
        {
          key: "strength",
          label: "Strength",
          headerClassName: "w-[10%]",
          render: (item) => (
            <span className="text-muted-foreground">{item.strength || "As user"}</span>
          ),
        },
        {
          key: "range",
          label: "Range",
          headerClassName: "w-[12%]",
          render: (item) => (
            <span className="text-muted-foreground">{item.range || "Close combat"}</span>
          ),
        },
        {
          key: "properties",
          label: "Properties",
          headerClassName: "w-[22%]",
          render: propertiesCell,
        },
        {
          key: "restricted",
          label: "Restricted to",
          headerClassName: "w-[12%]",
          render: (item) => <span className="text-muted-foreground">{item.unique_to || "-"}</span>,
        },
        {
          key: "grade",
          label: "Grade",
          headerClassName: "w-[8%]",
          render: (item) => <span className="text-muted-foreground">{item.grade || "-"}</span>,
        },
        {
          key: "rarity",
          label: "Rarity",
          headerClassName: "w-[6%]",
          render: (item) => <span className="text-muted-foreground">{formatRarity(item.rarity)}</span>,
        },
        {
          key: "price",
          label: "Price",
          headerClassName: "w-[8%]",
          render: (item) => (
            <span className="text-muted-foreground">{formatCost(item.cost)}</span>
          ),
        },
      ],
      armour: [
        {
          key: "name",
          label: "Name",
          headerClassName: "w-[20%]",
          render: (item) => <span className="font-medium text-foreground">{item.name}</span>,
        },
        {
          key: "save",
          label: "Save",
          headerClassName: "w-[10%]",
          render: (item) => <span className="text-muted-foreground">{item.save || "-"}</span>,
        },
        {
          key: "properties",
          label: "Properties",
          headerClassName: "w-[26%]",
          render: propertiesCell,
        },
        {
          key: "restricted",
          label: "Restricted to",
          headerClassName: "w-[16%]",
          render: (item) => <span className="text-muted-foreground">{item.unique_to || "-"}</span>,
        },
        {
          key: "grade",
          label: "Grade",
          headerClassName: "w-[8%]",
          render: (item) => <span className="text-muted-foreground">{item.grade || "-"}</span>,
        },
        {
          key: "rarity",
          label: "Rarity",
          headerClassName: "w-[8%]",
          render: (item) => <span className="text-muted-foreground">{formatRarity(item.rarity)}</span>,
        },
        {
          key: "price",
          label: "Price",
          headerClassName: "w-[10%]",
          render: (item) => (
            <span className="text-muted-foreground">{formatCost(item.cost)}</span>
          ),
        },
      ],
      misc: [
        {
          key: "name",
          label: "Name",
          headerClassName: "w-[24%]",
          render: (item) => <span className="font-medium text-foreground">{item.name}</span>,
        },
        {
          key: "properties",
          label: "Properties",
          headerClassName: "w-[30%]",
          render: propertiesCell,
        },
        {
          key: "singleUse",
          label: "Single use",
          headerClassName: "w-[10%]",
          render: (item) => (
            <span className="text-muted-foreground">{item.single_use ? "✓" : "-"}</span>
          ),
        },
        {
          key: "restricted",
          label: "Restricted to",
          headerClassName: "w-[16%]",
          render: (item) => <span className="text-muted-foreground">{item.unique_to || "-"}</span>,
        },
        {
          key: "grade",
          label: "Grade",
          headerClassName: "w-[8%]",
          render: (item) => <span className="text-muted-foreground">{item.grade || "-"}</span>,
        },
        {
          key: "rarity",
          label: "Rarity",
          headerClassName: "w-[8%]",
          render: (item) => <span className="text-muted-foreground">{formatRarity(item.rarity)}</span>,
        },
        {
          key: "price",
          label: "Price",
          headerClassName: "w-[10%]",
          render: (item) => (
            <span className="text-muted-foreground">{formatCost(item.cost)}</span>
          ),
        },
      ],
      animals: [
        {
          key: "name",
          label: "Name",
          headerClassName: "w-[18%]",
          render: (item) => <span className="font-medium text-foreground">{item.name}</span>,
        },
        {
          key: "subtype",
          label: "Type",
          headerClassName: "w-[10%]",
          render: (item) => <span className="text-muted-foreground">{item.subtype || "-"}</span>,
        },
        {
          key: "statblock",
          label: "Stats",
          headerClassName: "w-[30%]",
          render: (item) => renderStatblock(item.statblock),
        },
        {
          key: "properties",
          label: "Properties",
          headerClassName: "w-[18%]",
          render: propertiesCell,
        },
        {
          key: "restricted",
          label: "Restricted to",
          headerClassName: "w-[12%]",
          render: (item) => <span className="text-muted-foreground">{item.unique_to || "-"}</span>,
        },
        {
          key: "grade",
          label: "Grade",
          headerClassName: "w-[8%]",
          render: (item) => <span className="text-muted-foreground">{item.grade || "-"}</span>,
        },
        {
          key: "rarity",
          label: "Rarity",
          headerClassName: "w-[6%]",
          render: (item) => <span className="text-muted-foreground">{formatRarity(item.rarity)}</span>,
        },
        {
          key: "price",
          label: "Price",
          headerClassName: "w-[6%]",
          render: (item) => (
            <span className="text-muted-foreground">{formatCost(item.cost)}</span>
          ),
        },
      ],
    };

    return [
      ...(baseColumns[activeTab] ?? []),
      {
        key: "buttons",
        label: "",
        headerClassName: "w-[12%]",
        cellClassName: "whitespace-nowrap",
        render: (item) =>
          (
            <div className="flex items-center gap-2">
              <BuyItemDialog item={item} />
              {canManage && item.campaign_id ? (
                <EditItemDialog item={item} onUpdated={handleUpdated} onDeleted={handleDeleted} />
              ) : null}
            </div>
          ),
      },
    ];
  }, [activeTab, canManage, handleDeleted, handleUpdated, propertyMap]);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 justify-center">
          <h1 className="rpg-page-title self-start text-lg md:text-2xl">Wargear</h1>
          </div>
          {canAdd ? <CreateItemDialog campaignId={Number(id)} onCreated={handleCreated} /> : null}
        </div>
      </header>

      <TabbedCard
        tabs={itemTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        header={
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {activeTab === "weapons" || activeTab === "armour" || activeTab === "animals" ? (
                <Select value={selectedSubtype} onValueChange={setSelectedSubtype}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SUBTYPES}>All types</SelectItem>
                    {subtypeOptions.map((typeOption) => (
                      <SelectItem key={typeOption} value={typeOption}>
                        {typeOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {activeTab === "misc" ? (
                <Select value={selectedSingleUse} onValueChange={setSelectedSingleUse}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Filter by usage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SINGLE_USE}>All usage</SelectItem>
                    <SelectItem value={SINGLE_USE_ONLY}>Single use</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
            </div>
            <div className="w-full max-w-sm">
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search items..."
                aria-label="Search items"
              />
            </div>
          </div>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cataloging gear...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : tabItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No gear found.</p>
        ) : (
          <div className="space-y-4">
            {propertyError ? (
              <p className="px-4 py-2 text-xs text-red-500">{propertyError}</p>
            ) : null}
            <ScrollArea className="rpg-table-scroll">
              <table className="min-w-full text-sm table-fixed">
                <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className={[
                          "px-4 py-3 text-left font-semibold",
                          column.headerClassName ?? "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {tabItems.map((item) => (
                    <tr
                      key={item.id}
                      className="bg-transparent hover:bg-accent/20"
                    >
                      {columns.map((column) => (
                        <td
                          key={`${item.id}-${column.key}`}
                          className={[
                            "px-4 py-3 text-muted-foreground",
                            column.cellClassName ?? "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {column.render(item)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}
      </TabbedCard>
    </div>
  );
}
