import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

// components
import { Button } from "@components/button";
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
import AddSpellForm from "../components/AddSpellForm";
import AttuneSpellDialog from "../components/AttuneSpellDialog";
import SpellsTable from "../components/SpellsTable";
import { Input } from "@components/input";
import { Tooltip } from "@components/tooltip";
import basicBar from "@/assets/containers/basic_bar.webp";
import editIcon from "@/assets/components/edit.webp";

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
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [spells, setSpells] = useState<Spell[]>([]);
  const [selectedType, setSelectedType] = useState(ALL_TYPES);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

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
    setIsFormOpen(false);
    setEditingSpell(null);
  };

  const handleUpdated = (updatedSpell: Spell) => {
    setSpells((prev) =>
      prev.map((spell) => (spell.id === updatedSpell.id ? updatedSpell : spell))
    );
    setIsFormOpen(false);
    setEditingSpell(null);
  };

  const handleDeleted = (spellId: number) => {
    setSpells((prev) => prev.filter((spell) => spell.id !== spellId));
    setIsFormOpen(false);
    setEditingSpell(null);
  };

  const handleEdit = (spell: Spell) => {
    setEditingSpell(spell);
    setIsFormOpen(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      <PageHeader title="Spells" subtitle="Arcane powers and incantations" />

      <CardBackground disableBackground={isMobile} className={isMobile ? "flex min-h-0 flex-1 flex-col gap-3 p-3 rounded-none border-x-0" : "flex min-h-0 flex-1 flex-col gap-4 p-7"}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search spells..."
              aria-label="Search spells"
              className="max-w-sm flex-1 sm:flex-none"
            />
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-44 sm:w-56">
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
            {canAdd && !isFormOpen ? (
              <Button size="sm" onClick={() => setIsFormOpen(true)}>
                Add spell
              </Button>
            ) : null}
          </div>
        </div>
        {isFormOpen && (
          <div ref={formRef}>
            <AddSpellForm
              campaignId={Number(id)}
              onCreated={handleCreated}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              onCancel={() => { setIsFormOpen(false); setEditingSpell(null); }}
              typeOptions={typeOptions}
              editingSpell={editingSpell}
            />
          </div>
        )}
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
                  {spell.campaign_id ? (
                    <Tooltip
                      trigger={
                        <button
                          type="button"
                          aria-label="Edit spell"
                          onClick={() => handleEdit(spell)}
                          className="icon-button h-8 w-8 shrink-0 transition-[filter] hover:brightness-125"
                        >
                          <img src={editIcon} alt="" className="h-full w-full object-contain" />
                        </button>
                      }
                      content="Edit"
                    />
                  ) : null}
                </div>
              )}
            />
          )}
        </div>
      </CardBackground>
    </div>
  );
}
