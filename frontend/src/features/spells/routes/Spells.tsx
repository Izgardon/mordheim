import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// components
import { CardBackground } from "@components/card-background";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import { TableSkeleton } from "@components/table-skeleton";
import { PageHeader } from "@components/page-header";
import CreateSpellDialog from "../components/CreateSpellDialog";
import AttuneSpellDialog from "../components/AttuneSpellDialog";
import SpellsTable from "../components/SpellsTable";
import { Input } from "@components/input";
import basicBar from "@/assets/containers/basic_bar.webp";

// api
import { listSpells } from "../api/spells-api";
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";

// types
import type { Spell } from "../types/spell-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

const ALL_TYPES = "all";

const formatType = (value: string) => value.replace(/_/g, " ");

const SPELL_ROW_BG_STYLE: CSSProperties = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
};

export default function Spells() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [spells, setSpells] = useState<Spell[]>([]);
  const [selectedType, setSelectedType] = useState(ALL_TYPES);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);

  const canAdd =
    campaign?.role === "owner" ||
    campaign?.role === "admin" ||
    memberPermissions.includes("add_custom");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const campaignId = Number(id);
    listSpells(Number.isNaN(campaignId) ? {} : { campaignId })
      .then((data) => setSpells(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load spells");
        } else {
          setError("Unable to load spells");
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
    const unique = new Set(spells.map((spell) => spell.type).filter(Boolean) as string[]);
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [spells]);

  const filteredSpells = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const byType = selectedType === ALL_TYPES ? spells : spells.filter((spell) => spell.type === selectedType);
    if (!query) {
      return byType
        .slice()
        .sort((a, b) => {
          const typeCompare = (a.type || "").localeCompare(b.type || "");
          if (typeCompare !== 0) {
            return typeCompare;
          }
          const rollA = a.roll ?? Number.POSITIVE_INFINITY;
          const rollB = b.roll ?? Number.POSITIVE_INFINITY;
          if (rollA !== rollB) {
            return rollA - rollB;
          }
          return a.name.localeCompare(b.name);
        });
    }
    return byType
      .filter((spell) => {
        const haystack = [spell.name, spell.type, spell.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const typeCompare = (a.type || "").localeCompare(b.type || "");
        if (typeCompare !== 0) {
          return typeCompare;
        }
        const rollA = a.roll ?? Number.POSITIVE_INFINITY;
        const rollB = b.roll ?? Number.POSITIVE_INFINITY;
        if (rollA !== rollB) {
          return rollA - rollB;
        }
        return a.name.localeCompare(b.name);
      });
  }, [spells, searchQuery, selectedType]);

  const handleCreated = (newSpell: Spell) => {
    setSpells((prev) => [newSpell, ...prev]);
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      <PageHeader title="Spells" subtitle="Arcane powers and incantations" />

      <CardBackground className="flex min-h-0 flex-1 flex-col gap-4 p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="max-w-sm">
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search spells..."
                aria-label="Search spells"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES}>All types</SelectItem>
                {typeOptions.map((typeOption) => (
                  <SelectItem key={typeOption} value={typeOption}>
                    {formatType(typeOption)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center">
            {canAdd ? (
              <CreateSpellDialog
                campaignId={Number(id)}
                onCreated={handleCreated}
                typeOptions={typeOptions}
              />
            ) : null}
          </div>
        </div>
        <div className="flex flex-1 min-h-0 flex-col">
          {isLoading ? (
            <TableSkeleton columns={6} rows={12} />
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filteredSpells.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spells recorded yet.</p>
          ) : (
            <SpellsTable
              spells={filteredSpells}
              rowBackground={SPELL_ROW_BG_STYLE}
              renderActions={(spell) => (
                <div className="flex items-center justify-end gap-2">
                  <AttuneSpellDialog spell={spell} unitTypes={["heroes", "hiredswords"]} />
                </div>
              )}
            />
          )}
        </div>
      </CardBackground>
    </div>
  );
}
