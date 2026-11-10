import { useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { whoLine } from "@/features/items/utils/item-prices";
import { ALL_SETTINGS, inPlayOnly } from "@/features/reference/in-play";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { FilterRow, ReferenceChips, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useCatalogue } from "@/lib/catalogue-queries";
import { useMediaQuery } from "@/lib/use-media-query";

import GroupSkills from "../components/GroupSkills";
import SkillFormDialog from "../components/SkillFormDialog";
import SkillGroupFormDialog from "../components/SkillGroupFormDialog";
import {
  NO_GROUP_KEY,
  openRowOf,
  skillGroupRows,
  skillSettingOptions,
  type SkillGroupRow,
} from "../skill-group-rows";
import { useSkillGroups } from "../skill-groups";
import { learningNotes } from "../skill-learning";
import type { Skill, SkillGroup } from "../types/skill-types";

const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** `?group=`: a group's id, or "none" for the skills in no group. */
const groupParam = (row: SkillGroupRow) => (row.group ? String(row.group.id) : "none");
const rowKeyOf = (param: string) =>
  !param ? null : param === "none" ? NO_GROUP_KEY : `group-${param}`;

/** Who learns from a group, Large units only and its note: "For Amazons · Vampire only". */
const whoLearns = (group: SkillGroup | null) =>
  group ? [whoLine(group), ...learningNotes(group)].join(" · ") : "";

/**
 * Skills (William, 5 Nov 2026: "grouped in their skill group just like the spells page"): a row
 * per skill group with who learns from it, opening to its skills in play, each with its rules and
 * Edit skill. The search (name, group or rules) and the Setting filter keep the groups with a
 * match, and a search opens them. `?group=` opens a group, `?open=` lands on a skill in its group
 * (Search everything's links). Skills and skill groups are added and edited here.
 */
export default function Skills() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const skills = useCatalogue("skills", campaignId);
  const groups = useSkillGroups(campaignId);
  const settings = useSettingsById();
  const loading = skills.isLoading || groups.isLoading;
  const params = useReferenceParams(!loading, (get) => rowKeyOf(get("group")));
  const capabilities = campaignCapabilities(campaign);
  const setting = params.get("setting", ALL_SETTINGS);
  const searching = Boolean(params.query.trim());
  // the rows a search opened and the player closed again, for that search
  const [closed, setClosed] = useState({ query: "", keys: new Set<string>() });
  const [editing, setEditing] = useState<Skill | null>(null);
  const [editingGroup, setEditingGroup] = useState<SkillGroup | null>(null);

  const inPlay = useMemo(() => inPlayOnly(skills.data), [skills.data]);
  const settingOptions = skillSettingOptions(inPlay, settings);
  const rows = skillGroupRows(inPlayOnly(groups.groups), inPlay, {
    query: params.query,
    setting,
    settings,
    openId: params.openId,
  });
  const named = rowKeyOf(params.get("group"));
  const openKey = params.openId ? openRowOf(rows, params.openId, named) : named;
  const shut = closed.query === params.query ? closed.keys : new Set<string>();
  const isOpen = (row: SkillGroupRow) => (searching ? !shut.has(row.key) : openKey === row.key);
  const shown = new Set(rows.flatMap((row) => row.skills.map((skill) => skill.id))).size;

  const toggle = (row: SkillGroupRow) => {
    if (searching) {
      const keys = new Set(shut);
      if (keys.has(row.key)) keys.delete(row.key);
      else keys.add(row.key);
      setClosed({ query: params.query, keys });
      return;
    }
    params.set(isOpen(row) ? { group: null, open: null } : { group: groupParam(row), open: null });
  };
  const openGroup = rows.find((row) => row.key === openKey);
  const keepGroup = openGroup ? groupParam(openGroup) : null;

  const actions = capabilities.edit_catalogue ? (
    <>
      <SkillFormDialog
        mode="create"
        campaignId={campaignId}
        onCreated={(skill) => params.reveal(String(skill.id), { q: null, group: null })}
        trigger={
          <Button variant="secondary" className={isMobile ? "min-h-10" : undefined}>
            Add skill
          </Button>
        }
      />
      <SkillGroupFormDialog
        campaignId={campaignId}
        group={null}
        onSaved={(group) => params.set({ group: String(group.id), open: null, q: null })}
        trigger={
          // a phone's Section picker shares the row: the short name
          <Button variant="secondary" className={isMobile ? "min-h-10" : undefined}>
            {isMobile ? "Add group" : "Add skill group"}
          </Button>
        }
      />
    </>
  ) : null;

  return (
    <ReferencePage
      title="Skills"
      section="skills"
      archived={[
        { kind: "skills", campaignId, canRestore: capabilities.edit_catalogue, noun: "skills" },
        {
          kind: "skill-groups",
          campaignId,
          canRestore: capabilities.edit_catalogue,
          noun: "skill groups",
        },
      ]}
      actions={actions}
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
          </FilterRow>
          {settingOptions.length > 2 ? (
            <ReferenceChips
              label="Setting"
              options={settingOptions}
              value={setting}
              onChange={(next) => params.set({ setting: next === ALL_SETTINGS ? null : next })}
              isMobile={isMobile}
            />
          ) : null}
        </>
      }
      summary={
        isMobile
          ? undefined
          : searching || setting !== ALL_SETTINGS
            ? `${counted(shown, "skill")} in ${counted(rows.length, "group")}`
            : `${counted(rows.length, "group")}, ${counted(shown, "skill")}`
      }
    >
      {skills.error || groups.error ? (
        <p className="m-0 text-sm text-danger">{skills.error || groups.error}</p>
      ) : null}
      <ReferenceList
        nameLabel="Skill group"
        columns={
          isMobile
            ? undefined
            : [
                { label: "Skills", className: "w-[96px] shrink-0" },
                { label: "Who learns", className: "w-[300px] shrink-0" },
              ]
        }
        isEmpty={!loading && rows.length === 0}
        empty="No skills match."
      >
        {loading ? <ReferenceRowBones cells={2} /> : null}
        {(loading ? [] : rows).map((row) => {
          const count =
            row.matches === row.total ? String(row.total) : `${row.matches} of ${row.total}`;
          return (
            <ReferenceRow
              key={row.key}
              id={row.key}
              open={isOpen(row)}
              onToggle={() => toggle(row)}
              name={row.name}
              sub={isMobile ? whoLearns(row.group) || undefined : undefined}
              aside={
                <>
                  <span className="font-mono text-[13px] font-bold text-ink">{count}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.total === 1 ? "skill" : "skills"}
                  </span>
                </>
              }
              cells={
                isMobile
                  ? undefined
                  : [
                      <span key="count" className="font-mono">
                        {count}
                      </span>,
                      whoLearns(row.group),
                    ]
              }
            >
              <GroupSkills
                row={row}
                openId={row.key === openKey ? params.openId : null}
                onEditSkill={capabilities.edit_catalogue ? setEditing : null}
                onEditGroup={capabilities.edit_catalogue ? setEditingGroup : null}
                isMobile={isMobile}
              />
            </ReferenceRow>
          );
        })}
      </ReferenceList>
      {editing ? (
        <SkillFormDialog
          mode="edit"
          campaignId={campaignId}
          skill={editing}
          canDelete={capabilities.delete_catalogue}
          open
          onOpenChange={(open) => (open ? null : setEditing(null))}
          trigger={null}
          onUpdated={(saved) => params.reveal(String(saved.id), { group: keepGroup })}
          onDeleted={() => params.set({ open: null })}
        />
      ) : null}
      {editingGroup ? (
        <SkillGroupFormDialog
          campaignId={campaignId}
          group={editingGroup}
          canDelete={capabilities.delete_catalogue}
          open
          onOpenChange={(open) => (open ? null : setEditingGroup(null))}
          trigger={null}
          onSaved={(saved) => params.set({ group: String(saved.id), open: null })}
          onDeleted={() => params.set({ group: null, open: null })}
        />
      ) : null}
    </ReferencePage>
  );
}
