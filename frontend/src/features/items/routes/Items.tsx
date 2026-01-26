import { useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// components
import { Card, CardContent, CardHeader } from "@components/card";
import { Input } from "@components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import CreateItemDialog from "../components/CreateItemDialog";
import EditItemDialog from "../components/EditItemDialog";

// api
import { listItems } from "../api/items-api";
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";

// types
import type { Item } from "../types/item-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

const ALL_TYPES = "all";

const formatType = (value: string) => value.replace(/_/g, " ");
const formatRarity = (value?: number | null) => {
  if (value === 2) {
    return "Common";
  }
  if (value === null || value === undefined) {
    return "�";
  }
  return String(value);
};

export default function Items() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedType, setSelectedType] = useState(ALL_TYPES);
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

  const typeOptions = useMemo(() => {
    const unique = new Set(items.map((item) => item.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const byType = selectedType === ALL_TYPES ? items : items.filter((item) => item.type === selectedType);
    if (!query) {
      return byType;
    }
    return byType.filter((item) => {
      const haystack = [
        item.name,
        item.type,
        item.unique_to,
        item.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, searchQuery, selectedType]);

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

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filter by cache" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>All items</SelectItem>
                  {typeOptions.map((typeOption) => (
                    <SelectItem key={typeOption} value={typeOption}>
                      {formatType(typeOption)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cataloging gear...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gear found.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-[0_12px_24px_rgba(5,20,24,0.3)]">
              <table className="min-w-full table-fixed divide-y divide-border/70 text-sm">
                <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    <th className="w-[15%] px-4 py-3 text-left font-semibold">Name</th>
                    <th className="w-[10%] px-4 py-3 text-left font-semibold">Type</th>
                    <th className="w-[45%] px-4 py-3 text-left font-semibold">Description</th>
                    <th className="w-[15%] px-4 py-3 text-left font-semibold">Restricted to</th>
                    <th className="w-[7.5%] px-4 py-3 text-left font-semibold">Rarity</th>
                    <th className="w-[7.5%] px-4 py-3 text-left font-semibold">Price</th>
                    <th className="w-[10%] px-4 py-3 text-left font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="bg-transparent odd:bg-background/60 even:bg-card/60 hover:bg-accent/20"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatType(item.type)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.description || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.unique_to || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatRarity(item.rarity)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.cost}</td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          {item.campaign_id ? (
                            <EditItemDialog
                              item={item}
                              onUpdated={handleUpdated}
                              onDeleted={handleDeleted}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">Core</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



