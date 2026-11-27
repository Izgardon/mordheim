import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { useCampaignCapabilities } from "@/features/campaigns/capabilities";
import { ALL_SETTINGS } from "@/features/reference/in-play";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { FilterLine, FilterSelect } from "@/features/reference/FilterLine";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useWarbandTypes } from "@/features/warbands/api/warband-types-queries";
import { useMediaQuery } from "@/lib/use-media-query";

import { useWarbandTemplates } from "../api/template-queries";
import MakeTemplateDialog from "../components/MakeTemplateDialog";
import TemplateDetail from "../components/TemplateDetail";
import TemplateEditor from "../editor/TemplateEditor";
import { useCopyToWorkshop } from "@/features/workshop/api/useCopyToWorkshop";
import ImportListButton from "@/features/workshop/components/ImportListButton";
import { typeRows, type TemplateTypeRow } from "../template-view";
import {
  rowGrade,
  rowSettingLabel,
  shownWarbandRows,
  warbandSettingOptions,
} from "../warband-rows";

const counted = (count: number) => `${count} warband type${count === 1 ? "" : "s"}`;

/** A phone row's setting, and its grade where the setting's name doesn't already say it. */
const asideLabel = (setting: string, grade: string) =>
  grade && !setting.endsWith(grade) ? `${setting} · ${grade}` : setting;

type Making = { forType?: { id: number; name: string } } | null;

/** An open row of a type no template serves: Make a template, for those who edit the catalogue. */
function NoTemplate({ row, onMake }: { row: TemplateTypeRow; onMake: () => void }) {
  return (
    <div className="px-4 py-4">
      <Button variant="secondary" className="min-h-10" onClick={onMake}>
        Make a template for {row.typeName}
      </Button>
    </div>
  );
}

/**
 * Reference → Warbands (the templates plan, phases 1b and 4): each warband type in play with its
 * setting (William, 7 Nov 2026: "drop starting gold and most warriors ... add Setting column and
 * make it filterable/sortable") and grade (William, 8 Nov 2026), searched, filtered by setting
 * (Mordheim's grades as one), by name, opening in place
 * to its template (gold, warband size, variants, rules, fighters, lists, upgrades), or to Make a
 * template where it has none. Those who edit the catalogue edit a template in the editor (a
 * drawer on the web, a sheet on a phone).
 */
export default function WarbandTemplates() {
  const { id } = useParams();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const templates = useWarbandTemplates(campaignId);
  const types = useWarbandTypes(campaignId);
  const capabilities = useCampaignCapabilities(campaignId);
  const settings = useSettingsById();
  const params = useReferenceParams(!templates.isLoading);
  const [editing, setEditing] = useState<number | null>(null);
  const [making, setMaking] = useState<Making>(null);
  const copying = useCopyToWorkshop();
  const canEdit = capabilities.edit_catalogue;

  const rows = useMemo(() => typeRows(templates.data, types.data), [templates.data, types.data]);
  const setting = params.get("setting", ALL_SETTINGS);
  const settingOptions = warbandSettingOptions(rows, settings);
  const shown = shownWarbandRows(rows, { query: params.query, setting, settings });

  return (
    <ReferencePage
      title="Warband lists"
      section="warband-templates"
      actions={
        canEdit ? (
          <>
            <ImportListButton
              campaignId={campaignId}
              className={isMobile ? "min-h-10" : undefined}
            />
            <Button
              variant="secondary"
              className={isMobile ? "min-h-10" : undefined}
              onClick={() => setMaking({})}
            >
              Add new
            </Button>
          </>
        ) : null
      }
      filters={
        <>
          <FilterRow isMobile={isMobile}>
            <ReferenceSearch
              value={params.query}
              onChange={params.setQuery}
              placeholder="Search warbands"
              label="Search warbands"
              isMobile={isMobile}
            />
          </FilterRow>
          <FilterLine isMobile={isMobile}>
            {settingOptions.length > 2 ? (
              <FilterSelect
                label="Setting"
                options={settingOptions}
                value={setting}
                onChange={(next) => params.set({ setting: next === ALL_SETTINGS ? null : next })}
                isMobile={isMobile}
              />
            ) : null}
          </FilterLine>
        </>
      }
      summary={isMobile ? undefined : counted(shown.length)}
    >
      {templates.error ? <p className="m-0 text-sm text-danger">{templates.error}</p> : null}
      <ReferenceList
        nameLabel="Warband"
        columns={
          isMobile
            ? undefined
            : [
                { label: "Setting", className: "w-[200px] shrink-0" },
                // William, 8 Nov 2026: "on warbands table can we also show grade"
                { label: "Grade", className: "w-[80px] shrink-0" },
              ]
        }
        isEmpty={!templates.isLoading && shown.length === 0}
        empty="No warbands match."
      >
        {templates.isLoading ? <ReferenceRowBones cells={2} /> : null}
        {shown.map((row) => (
          <ReferenceRow
            key={row.id}
            id={row.id}
            open={params.isOpen(row.id)}
            onToggle={() => params.toggle(row.id)}
            name={row.typeName}
            sub={row.sub}
            dim={!row.template}
            aside={
              <span className="text-xs text-muted-foreground">
                {asideLabel(rowSettingLabel(row, settings), rowGrade(row, settings))}
              </span>
            }
            cells={
              isMobile
                ? undefined
                : [rowSettingLabel(row, settings), rowGrade(row, settings) || "–"]
            }
          >
            {row.template ? (
              <TemplateDetail
                campaignId={campaignId}
                templateId={row.template.id}
                preset={row.variant}
                typeId={row.typeId}
                isMobile={isMobile}
                onEdit={canEdit ? () => setEditing(row.template?.id ?? null) : undefined}
                onCopy={() => row.template && copying.copyList(row.template.id)}
              />
            ) : canEdit && row.typeId !== null ? (
              <NoTemplate
                row={row}
                onMake={() =>
                  setMaking({ forType: { id: row.typeId as number, name: row.typeName } })
                }
              />
            ) : null}
          </ReferenceRow>
        ))}
      </ReferenceList>
      {making ? (
        <MakeTemplateDialog
          open
          onOpenChange={(open) => (open ? null : setMaking(null))}
          campaignId={campaignId}
          forType={making.forType}
          onMade={setEditing}
        />
      ) : null}
      <TemplateEditor
        campaignId={campaignId}
        templateId={editing}
        onTemplateChange={setEditing}
        onClose={() => setEditing(null)}
      />
    </ReferencePage>
  );
}
