import { useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// components
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
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

    listItems()
      .then((data) => setItems(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load items");
        } else {
          setError("Unable to load items");
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

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
    if (selectedType === ALL_TYPES) {
      return items;
    }
    return items.filter((item) => item.type === selectedType);
  }, [items, selectedType]);

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
          {canCreate ? (
            <CreateItemDialog campaignId={Number(id)} onCreated={handleCreated} />
          ) : null}
        </div>
      </header>

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
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {filteredItems.length} entries
        </span>
      </div>

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
            <div className="overflow-hidden rounded-lg border-2 border-border/70 bg-card/70 shadow-[4px_4px_0_rgba(23,16,8,0.2)]">
              <table className="min-w-full divide-y divide-border/70 text-sm">
                <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Cost</th>
                    <th className="px-4 py-3 text-left font-semibold">Availability</th>
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
                      <td className="px-4 py-3 text-muted-foreground">{item.availability}</td>
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



