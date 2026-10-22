// routing
import { useOutletContext, useParams, useNavigate } from "react-router-dom";

// data
import { ALL_TYPES, useCatalogueFilters } from "@/features/catalogue/hooks/useCatalogueFilters";
import { useCatalogueEditor } from "@/features/catalogue/hooks/useCatalogueEditor";
import { useCatalogue } from "@/lib/catalogue-queries";
import { useMediaQuery } from "@/lib/use-media-query";

// components
import { Button } from "@components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";
import { TableSkeleton } from "@components/table-skeleton";
import { PageHeader } from "@components/page-header";
import MobileTabs from "@components/mobile-tabs";
import { EditRowButton } from "@/features/catalogue/components/EditRowButton";
import AddSpellForm from "../components/AddSpellForm";
import AttuneSpellDialog from "../components/AttuneSpellDialog";
import SpellsTable from "../components/SpellsTable";
import { Input } from "@components/input";

// api
import { campaignCapabilities } from "@/features/campaigns/capabilities";

// types
import type { Spell } from "../types/spell-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

import { LOADOUT_TABS } from "@/lib/loadout-tabs";
import type { LoadoutTabId } from "@/lib/loadout-tabs";

const formatType = (value: string) => value.replace(/_/g, " ");

const spellHaystack = (spell: Spell) => [spell.name, spell.type, spell.description];

/** By class, then by roll (spells with none last), then by name. */
const compareSpells = (a: Spell, b: Spell) => {
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
};

export default function Spells() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const campaignId = Number(id);
  const { data: spells, isLoading, error } = useCatalogue("spells", campaignId);
  const filters = useCatalogueFilters(spells, { haystack: spellHaystack, compare: compareSpells });
  // AddSpellForm writes created, edited and deleted spells to the shared cache itself.
  const editor = useCatalogueEditor<Spell>();

  const capabilities = campaignCapabilities(campaign);
  const canEdit = capabilities.edit_catalogue;

  const handleLoadoutTabChange = (tabId: LoadoutTabId) => {
    if (!id) {
      return;
    }
    navigate(`/campaigns/${id}/${tabId}`);
  };

  return (
    <div className="min-h-0 flex h-full flex-col gap-4 sm:gap-6">
      <PageHeader title="Spells" subtitle="Arcane powers and incantations" />

      {isMobile ? (
        <MobileTabs
          tabs={LOADOUT_TABS}
          activeTab="spells"
          onTabChange={handleLoadoutTabChange}
          className="mt-2"
          showDivider
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 sm:gap-4 sm:px-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex flex-col gap-3 sm:flex-row md:min-w-0 md:flex-1 md:flex-nowrap md:items-center">
            <Input
              type="search"
              value={filters.searchQuery}
              onChange={(event) => filters.setSearchQuery(event.target.value)}
              placeholder="Search spells..."
              aria-label="Search spells"
              className="w-full sm:max-w-sm md:w-full md:max-w-sm md:flex-none"
            />
            <Select value={filters.selectedType} onValueChange={filters.setSelectedType}>
              <SelectTrigger className="w-full sm:w-56 md:shrink-0">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES}>All types</SelectItem>
                {filters.typeOptions.map((typeOption) => (
                  <SelectItem key={typeOption} value={typeOption}>
                    {formatType(typeOption)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-end md:shrink-0">
            {canEdit && !editor.isOpen ? (
              <Button size="sm" className="md:h-11" onClick={editor.openNew}>
                Add spell
              </Button>
            ) : null}
          </div>
        </div>
        {editor.isOpen && (
          <div ref={editor.formRef}>
            <AddSpellForm
              campaignId={campaignId}
              onCreated={editor.close}
              onUpdated={editor.close}
              onDeleted={editor.close}
              onCancel={editor.close}
              typeOptions={filters.typeOptions}
              editingSpell={editor.editing}
              canDelete={capabilities.delete_catalogue}
              onEditMatch={(match) => {
                const entry = spells.find((listed) => listed.id === match.id);
                if (entry) editor.edit(entry);
              }}
            />
          </div>
        )}
        <div className="flex flex-1 min-h-0 flex-col">
          {isLoading ? (
            <TableSkeleton columns={6} rows={12} />
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filters.filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spells recorded yet.</p>
          ) : (
            <SpellsTable
              spells={filters.filtered}
              isMobile={isMobile}
              renderActions={(spell) => (
                <div className="flex items-center justify-end gap-2">
                  <AttuneSpellDialog spell={spell} unitTypes={["heroes", "hiredswords"]} />
                  {/* A book spell's edit makes the campaign's version (CAT-TWEAK-01). */}
                  {canEdit ? (
                    <EditRowButton label="Edit spell" onClick={() => editor.edit(spell)} />
                  ) : null}
                </div>
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
