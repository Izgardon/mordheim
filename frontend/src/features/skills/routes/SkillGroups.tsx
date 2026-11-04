import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { whoLine } from "@/features/items/utils/item-prices";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
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

import SkillGroupFormDialog from "../components/SkillGroupFormDialog";
import { useSkillGroups } from "../skill-groups";
import { learningNotes } from "../skill-learning";

/**
 * Skill groups (skill groups, phase 1a; design E's reference layout): every group of the campaign,
 * the core five first, with who learns from it, Large units only and the note shown when learning
 * from it, and its skills. A row opens to its skills; groups are added and edited here.
 */
export default function SkillGroups() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const groups = useSkillGroups(campaignId);
  const skills = useCatalogue("skills", campaignId).data;
  const params = useReferenceParams(!groups.isLoading);
  const capabilities = campaignCapabilities(campaign);
  const names = new Map(skills.map((skill) => [skill.id, skill.name]));
  const skillNames = (ids: number[]) =>
    ids.flatMap((skillId) => (names.has(skillId) ? [names.get(skillId) as string] : []));
  const rows = groups.groups.filter(
    (group) =>
      String(group.id) === params.openId ||
      matchesSearchQuery(params.query, group.name, skillNames(group.skill_ids).join(" "))
  );
  const shown = useShownRows(
    rows,
    rows.findIndex((group) => String(group.id) === params.openId)
  );

  const addButton = capabilities.edit_catalogue ? (
    <SkillGroupFormDialog
      campaignId={campaignId}
      group={null}
      onSaved={(group) => params.set({ open: String(group.id), q: null })}
      trigger={
        <Button variant="secondary" className={isMobile ? "min-h-10" : undefined}>
          Add skill group
        </Button>
      }
    />
  ) : null;

  return (
    <ReferencePage
      title="Skill groups"
      section="skill-groups"
      archived={{
        kind: "skill-groups",
        campaignId,
        canRestore: capabilities.edit_catalogue,
        noun: "skill groups",
      }}
      actions={addButton}
      filters={
        <FilterRow isMobile={isMobile}>
          <ReferenceSearch
            value={params.query}
            onChange={params.setQuery}
            placeholder="Search skill groups"
            label="Search skill groups"
            isMobile={isMobile}
          />
        </FilterRow>
      }
      summary={
        isMobile ? undefined : `${rows.length} ${rows.length === 1 ? "group" : "groups"} shown`
      }
    >
      {groups.error ? <p className="m-0 text-sm text-danger">{groups.error}</p> : null}
      <ReferenceList
        nameLabel="Skill group"
        columns={isMobile ? undefined : [{ label: "Who learns", className: "w-[300px] shrink-0" }]}
        isEmpty={!groups.isLoading && rows.length === 0}
        empty="No skill groups match."
      >
        {groups.isLoading ? <ReferenceRowBones /> : null}
        {shown.rows.map((group) => {
          const key = String(group.id);
          const who = [whoLine(group), ...learningNotes(group)].join(" · ");
          return (
            <ReferenceRow
              key={key}
              id={key}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
              name={group.name}
              sub={isMobile ? who : undefined}
              cells={isMobile ? undefined : [who]}
            >
              <div className={isMobile ? "flex flex-col gap-2" : "flex flex-col gap-2 px-4 pb-4"}>
                <RulesPanel
                  detail={{
                    name: group.name,
                    kind: who,
                    text: skillNames(group.skill_ids).join(", "),
                  }}
                  onClose={params.close}
                />
                {capabilities.edit_catalogue ? (
                  <SkillGroupFormDialog
                    campaignId={campaignId}
                    group={group}
                    canDelete={capabilities.delete_catalogue}
                    onSaved={(saved) => params.set({ open: String(saved.id) })}
                    onDeleted={() => params.close()}
                    trigger={
                      <Button variant="secondary" className="min-h-10 self-start">
                        Edit skill group
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
