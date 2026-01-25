import { useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// components
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import FilterSearchActionHeader from "../../../components/ui/filter-search-action-header";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import CreateItemDialog from "../components/CreateItemDialog";

// api
import { listItems } from "../api/items-api";
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";

// types
import type { Item } from "../types/item-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

const ALL_TYPES = "all";

const formatType = (value: string) => value.replace(/_/g, " ");

export default function Items() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedType, setSelectedType] = useState(ALL_TYPES);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);

  const canCreate =
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

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">Wargear</h1>
          </div>
        </div>
      </header>

      <FilterSearchActionHeader
        filters={
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
        }
        search={
          <div className="w-full max-w-sm">
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search items..."
              aria-label="Search items"
            />
          </div>
        }
        actions={
          <>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {filteredItems.length} entries
            </span>
            {canCreate ? (
              <CreateItemDialog campaignId={Number(id)} onCreated={handleCreated} />
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Wargear list</CardTitle>
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
              <table className="min-w-full divide-y divide-border/70 text-sm">
                <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Price</th>
                    <th className="px-4 py-3 text-left font-semibold">Rarity</th>
                    <th className="px-4 py-3 text-left font-semibold">Restricted to</th>
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
                      <td className="px-4 py-3 text-muted-foreground">{item.cost}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.rarity}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.unique_to || "-"}</td>
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



