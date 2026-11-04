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
import { groupsOf, isCore, useSkillGroups } from "../skill-groups";
import { learningNotes } from "../skill-learning";
import type { Skill, SkillGroup } from "../types/skill-types";

const OTHER = "other";

const names = (groups: SkillGroup[]) => groups.map((group) => group.name).join(", ");

/**
 * Skills (design E's reference layout): every skill in play in the campaign once, with the groups
 * holding it, searched by name, group or rules text, with chips for the five core groups and
 * "Other groups" (with a picker for one of them). A row opens to its rules in the warband page's
 * rules panel; custom skills are added and edited as today.
 */
export default function Skills() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const skills = useCatalogue("skills", campaignId);
  const groups = useSkillGroups(campaignId);
  const params = useReferenceParams(!skills.isLoading);
  const capabilities = campaignCapabilities(campaign);
  const list = params.get("list", "all");
  const otherGroup = params.get("other");

  const sorted = useMemo(
    () => inPlayOnly(skills.data).sort((a, b) => a.name.localeCompare(b.name)),
    [skills.data]
  );
  const held = (skill: Skill) => groupsOf(groups, skill.id);
  const core = groups.groups.filter(isCore);
  const others = groups.groups.filter((group) => !isCore(group));
  const searched = sorted.filter((skill) =>
    matchesSearchQuery(params.query, skill.name, names(held(skill)), skill.description)
  );
  const inList = (skill: Skill) => {
    if (list === "all") return true;
    const ids = held(skill).map((group) => String(group.id));
    if (list !== OTHER) return ids.includes(list);
    return otherGroup ? ids.includes(otherGroup) : held(skill).some((group) => !isCore(group));
  };
  const rows = sorted.filter(
    (skill) => String(skill.id) === params.openId || (searched.includes(skill) && inList(skill))
  );
  const shown = useShownRows(
    rows,
    rows.findIndex((skill) => String(skill.id) === params.openId)
  );
  const count = (group: SkillGroup) =>
    searched.filter((skill) => group.skill_ids.includes(skill.id)).length;
  const chips = [
    { id: "all", label: "All", count: searched.length },
    ...core.map((group) => ({ id: String(group.id), label: group.name, count: count(group) })),
    ...(others.length
      ? [
          {
            id: OTHER,
            label: "Other groups",
            count: searched.filter((skill) => held(skill).some((group) => !isCore(group))).length,
          },
        ]
      : []),
  ];

  const addButton = capabilities.edit_catalogue ? (
    <SkillFormDialog
      mode="create"
      campaignId={campaignId}
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
              <FilterField label="Group" isMobile={isMobile} className="shrink-0">
                <select
                  aria-label="Skill group"
                  value={otherGroup}
                  onChange={(event) => params.set({ other: event.target.value })}
                  className="min-h-11 border border-strong bg-rail px-2.5 text-sm text-ink"
                >
                  <option value="">All other groups</option>
                  {others.map((group) => (
                    <option key={group.id} value={String(group.id)}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </FilterField>
            ) : null}
          </FilterRow>
          <ReferenceChips
            label="Group"
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
        columns={isMobile ? undefined : [{ label: "Groups", className: "w-[260px] shrink-0" }]}
        isEmpty={!skills.isLoading && rows.length === 0}
        empty="No skills match."
      >
        {skills.isLoading ? <ReferenceRowBones /> : null}
        {shown.rows.map((skill) => {
          const key = String(skill.id);
          const its = held(skill);
          const notes = [...new Set(its.flatMap((group) => learningNotes(group)))];
          return (
            <ReferenceRow
              key={key}
              id={key}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
              name={skill.name}
              sub={isMobile ? names(its) : undefined}
              cells={isMobile ? undefined : [names(its)]}
            >
              <div className={isMobile ? "flex flex-col gap-2" : "flex flex-col gap-2 px-4 pb-4"}>
                <RulesPanel
                  detail={{
                    name: skill.name,
                    kind: [names(its), ...notes].filter(Boolean).join(" · "),
                    text: skill.description,
                  }}
                  onClose={params.close}
                />
                {capabilities.edit_catalogue ? (
                  <SkillFormDialog
                    mode="edit"
                    campaignId={campaignId}
                    skill={skill}
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
