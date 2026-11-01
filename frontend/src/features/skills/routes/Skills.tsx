import { useMemo } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { inPlayOnly } from "@/features/reference/in-play";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import {
  FilterField,
  FilterRow,
  ReferenceChips,
  ReferenceSearch,
} from "@/features/reference/ReferenceFilters";
import {
  ReferenceList,
  ReferenceRow,
  ShowMore,
  useShownRows,
} from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import RulesPanel from "@/features/warbands/components/roster/RulesPanel";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import SkillFormDialog from "../components/SkillFormDialog";
import { learningNotes } from "../skill-learning";
import type { Skill } from "../types/skill-types";

/** The five common lists, in the book's order; every other list is "Other lists". */
const CORE = ["Combat", "Shooting", "Academic", "Strength", "Speed"];
const OTHER = "other";

const listName = (type: string) => type.replace(/_/g, " ");

/** The core lists first, in order, then the rest by list; by name within a list. */
const rank = (type: string) => {
  const index = CORE.indexOf(type);
  return index === -1 ? CORE.length : index;
};
const compareSkills = (a: Skill, b: Skill) =>
  rank(a.type) - rank(b.type) || a.type.localeCompare(b.type) || a.name.localeCompare(b.name);

/**
 * Skills (design E's reference layout): every skill in play in the campaign by list, searched by
 * name or rules text, with chips for the five common lists and "Other lists" (with a picker for
 * one of them). A row opens to its rules in the warband page's rules panel; custom skills are
 * added and edited as today.
 */
export default function Skills() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const skills = useCatalogue("skills", campaignId);
  const params = useReferenceParams(!skills.isLoading);
  const capabilities = campaignCapabilities(campaign);
  const list = params.get("list", "all");
  const otherList = params.get("other");

  const sorted = useMemo(() => inPlayOnly(skills.data).sort(compareSkills), [skills.data]);
  const types = useMemo(() => [...new Set(sorted.map((skill) => skill.type))], [sorted]);
  const otherTypes = types.filter((type) => !CORE.includes(type));
  const searched = sorted.filter((skill) =>
    matchesSearchQuery(params.query, skill.name, skill.type, skill.description)
  );
  const inList = (skill: Skill) =>
    list === "all" ||
    (list === OTHER
      ? !CORE.includes(skill.type) && (!otherList || skill.type === otherList)
      : skill.type === list);
  const rows = sorted.filter(
    (skill) => String(skill.id) === params.openId || (searched.includes(skill) && inList(skill))
  );
  const shown = useShownRows(
    rows,
    rows.findIndex((skill) => String(skill.id) === params.openId)
  );
  const chips = [
    { id: "all", label: "All", count: searched.length },
    ...CORE.filter((type) => types.includes(type)).map((type) => ({
      id: type,
      label: type,
      count: searched.filter((skill) => skill.type === type).length,
    })),
    ...(otherTypes.length
      ? [
          {
            id: OTHER,
            label: "Other lists",
            count: searched.filter((skill) => !CORE.includes(skill.type)).length,
          },
        ]
      : []),
  ];

  const addButton = capabilities.edit_catalogue ? (
    <SkillFormDialog
      mode="create"
      campaignId={campaignId}
      typeOptions={types}
      onCreated={(skill) => params.set({ open: String(skill.id), q: null })}
      trigger={
        <Button variant="secondary" className={isMobile ? "min-h-10" : undefined}>
          Add skill
        </Button>
      }
    />
  ) : null;

  return (
    <ReferencePage
      title="Skills"
      section="skills"
      archived={{
        kind: "skills",
        campaignId,
        canRestore: capabilities.edit_catalogue,
        noun: "skills",
      }}
      actions={addButton}
      filters={
        <>
          <FilterRow isMobile={isMobile}>
            <ReferenceSearch
              value={params.query}
              onChange={params.setQuery}
              placeholder="Search skills"
              label="Search skills"
              isMobile={isMobile}
            />
            {list === OTHER ? (
              <FilterField label="List" isMobile={isMobile} className="shrink-0">
                <select
                  aria-label="Skill list"
                  value={otherList}
                  onChange={(event) => params.set({ other: event.target.value })}
                  className="min-h-11 border border-strong bg-rail px-2.5 text-sm text-ink"
                >
                  <option value="">All other lists</option>
                  {otherTypes.map((type) => (
                    <option key={type} value={type}>
                      {listName(type)}
                    </option>
                  ))}
                </select>
              </FilterField>
            ) : null}
          </FilterRow>
          <ReferenceChips
            label="List"
            options={chips}
            value={list}
            onChange={(next) => params.set({ list: next === "all" ? null : next, other: null })}
            isMobile={isMobile}
          />
        </>
      }
      summary={
        isMobile ? undefined : `${rows.length} ${rows.length === 1 ? "skill" : "skills"} shown`
      }
    >
      {skills.error ? <p className="m-0 text-sm text-danger">{skills.error}</p> : null}
      <ReferenceList
        nameLabel="Skill"
        columns={isMobile ? undefined : [{ label: "List", className: "w-[220px] shrink-0" }]}
        isEmpty={!skills.isLoading && rows.length === 0}
        empty="No skills match. Try another word or list."
      >
        {skills.isLoading ? <ReferenceRowBones /> : null}
        {shown.rows.map((skill) => {
          const key = String(skill.id);
          return (
            <ReferenceRow
              key={key}
              id={key}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
              name={skill.name}
              sub={isMobile ? listName(skill.type) : undefined}
              cells={isMobile ? undefined : [listName(skill.type)]}
            >
              <div className={isMobile ? "flex flex-col gap-2" : "flex flex-col gap-2 px-4 pb-4"}>
                <RulesPanel
                  detail={{
                    name: skill.name,
                    kind: [listName(skill.type), ...learningNotes(skill)].join(" · "),
                    text: skill.description,
                  }}
                  onClose={params.close}
                />
                {capabilities.edit_catalogue ? (
                  <SkillFormDialog
                    mode="edit"
                    campaignId={campaignId}
                    skill={skill}
                    typeOptions={types}
                    canDelete={capabilities.delete_catalogue}
                    onUpdated={(saved) => params.set({ open: String(saved.id) })}
                    onDeleted={() => params.close()}
                    trigger={
                      <Button variant="secondary" className="min-h-10 self-start">
                        Edit skill
                      </Button>
                    }
                  />
                ) : null}
              </div>
            </ReferenceRow>
          );
        })}
      </ReferenceList>
      {rows.length > 0 ? (
        <ShowMore shown={shown.rows.length} total={rows.length} onMore={shown.showMore} />
      ) : null}
    </ReferencePage>
  );
}
