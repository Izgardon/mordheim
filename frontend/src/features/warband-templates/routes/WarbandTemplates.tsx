import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useCampaignCapabilities } from "@/features/campaigns/capabilities";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useWarbandTypes } from "@/features/warbands/api/warband-types-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import { useWarbandTemplates } from "../api/template-queries";
import MakeTemplateDialog from "../components/MakeTemplateDialog";
import TemplateDetail from "../components/TemplateDetail";
import TemplateEditor from "../editor/TemplateEditor";
import { termsFor, typeRows, type TemplateTypeRow } from "../template-view";

const counted = (count: number) => `${count} warband type${count === 1 ? "" : "s"}`;

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
 * Reference → Warbands (the templates plan, phases 1b and 4): each warband type in play, opening
 * in place to its template (gold, most warriors, variants, rules, fighters, lists, upgrades), or
 * to Make a template where it has none. Those who edit the catalogue edit a template in the
 * editor (a drawer on the web, a sheet on a phone).
 */
export default function WarbandTemplates() {
  const { id } = useParams();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const templates = useWarbandTemplates(campaignId);
  const types = useWarbandTypes(campaignId);
  const capabilities = useCampaignCapabilities(campaignId);
  const params = useReferenceParams(!templates.isLoading);
  const [editing, setEditing] = useState<number | null>(null);
  const [making, setMaking] = useState<Making>(null);
  const canEdit = capabilities.edit_catalogue;

  const rows = useMemo(() => typeRows(templates.data, types.data), [templates.data, types.data]);
  const shown = rows.filter((row) =>
    matchesSearchQuery(params.query, row.typeName, row.template?.name ?? "")
  );
  const figures = (row: TemplateTypeRow) =>
    row.template ? termsFor(row.template, row.variant) : { gold: "–", mostWarriors: "–" };

  return (
    <ReferencePage
      title="Warbands"
      section="warband-templates"
      actions={
        canEdit ? (
          <Button
            variant="secondary"
            className={isMobile ? "min-h-10" : undefined}
            onClick={() => setMaking({})}
          >
            Make a template
          </Button>
        ) : null
      }
      filters={
        <FilterRow isMobile={isMobile}>
          <ReferenceSearch
            value={params.query}
            onChange={params.setQuery}
            placeholder="Search warbands"
            label="Search warbands"
            isMobile={isMobile}
          />
        </FilterRow>
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
                { label: "Starting gold", className: "w-[120px] shrink-0" },
                { label: "Most warriors", className: "w-[120px] shrink-0" },
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
              <span className="font-mono text-[13px] font-bold text-ink">
                {row.template ? `${figures(row).gold} gc` : "–"}
              </span>
            }
            cells={
              isMobile
                ? undefined
                : [
                    <span key="gold" className="font-mono">
                      {row.template ? `${figures(row).gold} gc` : "–"}
                    </span>,
                    <span key="size" className="font-mono">
                      {figures(row).mostWarriors}
                    </span>,
                  ]
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
