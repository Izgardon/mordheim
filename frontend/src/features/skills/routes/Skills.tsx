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
import AddSkillForm from "../components/AddSkillForm";
import LearnSkillDialog from "../components/LearnSkillDialog";
import SkillsTable from "../components/SkillsTable";
import { Input } from "@components/input";

// api
import { campaignCapabilities } from "@/features/campaigns/capabilities";

// types
import type { Skill } from "../types/skill-types";
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

import { LOADOUT_TABS } from "@/lib/loadout-tabs";
import type { LoadoutTabId } from "@/lib/loadout-tabs";

const PRIORITY_TYPES = ["Combat", "Shooting", "Strength", "Speed", "Academic"];

const formatType = (value: string) => value.replace(/_/g, " ");

const skillHaystack = (skill: Skill) => [skill.name, skill.type, skill.description];

/** The five common lists first, in that order, then the rest by list; by name within a list. */
const compareSkills = (a: Skill, b: Skill) => {
  const aPriority = PRIORITY_TYPES.indexOf(a.type);
  const bPriority = PRIORITY_TYPES.indexOf(b.type);
  const aRank = aPriority === -1 ? Number.POSITIVE_INFINITY : aPriority;
  const bRank = bPriority === -1 ? Number.POSITIVE_INFINITY : bPriority;
  if (aRank !== bRank) {
    return aRank - bRank;
  }
  const typeCompare = a.type.localeCompare(b.type);
  if (typeCompare !== 0) {
    return typeCompare;
  }
  return a.name.localeCompare(b.name);
};

export default function Skills() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const navigate = useNavigate();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const { data: skills, isLoading, error } = useCatalogue("skills", campaignId);
  const filters = useCatalogueFilters(skills, { haystack: skillHaystack, compare: compareSkills });
  // AddSkillForm writes created, edited and deleted skills to the shared cache itself.
  const editor = useCatalogueEditor<Skill>();

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
      <PageHeader title="Skills" subtitle="Combat disciplines and abilities" />

      {isMobile ? (
        <MobileTabs
          tabs={LOADOUT_TABS}
          activeTab="skills"
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
              placeholder="Search skills..."
              aria-label="Search skills"
              className="w-full sm:max-w-sm md:w-full md:max-w-sm md:flex-none"
            />
            <Select value={filters.selectedType} onValueChange={filters.setSelectedType}>
              <SelectTrigger className="w-full sm:w-56 md:shrink-0">
                <SelectValue placeholder="Filter by discipline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES}>All disciplines</SelectItem>
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
                Add skill
              </Button>
            ) : null}
          </div>
        </div>
        {editor.isOpen && (
          <div ref={editor.formRef}>
            <AddSkillForm
              campaignId={campaignId}
              onCreated={editor.close}
              onUpdated={editor.close}
              onDeleted={editor.close}
              onCancel={editor.close}
              typeOptions={filters.typeOptions}
              editingSkill={editor.editing}
              canDelete={capabilities.delete_catalogue}
            />
          </div>
        )}
        <div className="flex flex-1 min-h-0 flex-col">
          {isLoading ? (
            <TableSkeleton columns={4} rows={12} />
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filters.filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills logged yet.</p>
          ) : (
            <SkillsTable
              skills={filters.filtered}
              isMobile={isMobile}
              renderActions={(skill) => (
                <div className="flex items-center justify-end gap-2">
                  <LearnSkillDialog skill={skill} unitTypes={["heroes", "hiredswords"]} />
                  {canEdit && skill.campaign_id ? (
                    <EditRowButton label="Edit skill" onClick={() => editor.edit(skill)} />
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
