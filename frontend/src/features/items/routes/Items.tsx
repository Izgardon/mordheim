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
import TabbedCard from "@components/tabbed-card";
import CreateItemDialog from "../components/CreateItemDialog";
import EditItemDialog from "../components/EditItemDialog";

// utils
import { renderBoldMarkdown } from "../../../lib/render-bold-markdown";

// api
import { listItems } from "../api/items-api";
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";

// types
import type { Item } from "../types/item-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

const ALL_SUBTYPES = "all";
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
  Animal: ["Mount", "Attack"],
};

type ColumnConfig = {
  key: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (item: Item) => ReactNode;
};

const renderStatblock = (statblock?: string | null) => {
  if (!statblock) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (statblock.includes("[[table]]")) {
    return <div className="text-xs text-muted-foreground">{renderBoldMarkdown(statblock)}</div>;
  }

  try {
    const parsed = JSON.parse(statblock) as Record<string, string | number>;
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
                <th key={header} className="px-2 py-2 text-left font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/60">
              {values.map((value, index) => (
                <td key={`${STAT_HEADERS[index]}-${index}`} className="px-2 py-2">
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
  const [activeTab, setActiveTab] = useState<ItemTabId>("weapons");
  const [selectedSubtype, setSelectedSubtype] = useState(ALL_SUBTYPES);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
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
      return byType;
    }
    return byType.filter(
      (item) => (item.subtype ?? "").toLowerCase() === selectedSubtype.toLowerCase()
    );
  }, [filteredItems, activeTab, selectedSubtype]);

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
            <button
              key={property.id}
              type="button"
              className="text-xs font-semibold text-muted-foreground underline decoration-dotted underline-offset-2 transition hover:text-foreground"
            >
              {property.name}
            </button>
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

    const base = baseColumns[activeTab] ?? [];
    if (!canManage) {
      return base;
    }

    return [
      ...base,
      {
        key: "actions",
        label: "",
        headerClassName: "w-[8%]",
        render: (item) =>
          item.campaign_id ? (
            <EditItemDialog item={item} onUpdated={handleUpdated} onDeleted={handleDeleted} />
          ) : (
            <span className="text-xs text-muted-foreground">Core</span>
          ),
      },
    ];
  }, [activeTab, canManage, handleDeleted, handleUpdated]);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">Wargear</h1>
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
              {activeTab === "weapons" || activeTab === "animals" ? (
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
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-[0_12px_24px_rgba(5,20,24,0.3)]">
            <table className="min-w-full table-fixed divide-y divide-border/70 text-sm">
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
                    className="bg-transparent odd:bg-background/60 even:bg-card/60 hover:bg-accent/20"
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
          </div>
        )}
      </TabbedCard>
    </div>
  );
}
