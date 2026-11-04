import { useMemo } from "react";
import { useParams } from "react-router-dom";

import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import { useWarbandTemplates } from "../api/template-queries";
import TemplateDetail from "../components/TemplateDetail";
import { termsFor, typeRows } from "../template-view";

const counted = (count: number) => `${count} warband type${count === 1 ? "" : "s"}`;

/**
 * Reference → Warbands (the templates plan, phase 1b): each warband type in play that has a
 * template, opening in place to it (gold, most warriors, variants, rules, fighters, lists,
 * upgrades). Read only; raising and hiring from it come later.
 */
export default function WarbandTemplates() {
  const { id } = useParams();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const templates = useWarbandTemplates(campaignId);
  const params = useReferenceParams(!templates.isLoading);

  const rows = useMemo(() => typeRows(templates.data), [templates.data]);
  const shown = rows.filter((row) =>
    matchesSearchQuery(params.query, row.typeName, row.template.name)
  );

  return (
    <ReferencePage
      title="Warbands"
      section="warband-templates"
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
            sub={row.template.name === row.typeName ? undefined : row.template.name}
            aside={
              <span className="font-mono text-[13px] font-bold text-ink">
                {termsFor(row.template, row.variant).gold} gc
              </span>
            }
            cells={
              isMobile
                ? undefined
                : [
                    <span key="gold" className="font-mono">
                      {termsFor(row.template, row.variant).gold} gc
                    </span>,
                    <span key="size" className="font-mono">
                      {termsFor(row.template, row.variant).mostWarriors}
                    </span>,
                  ]
            }
          >
            <TemplateDetail
              campaignId={campaignId}
              templateId={row.template.id}
              preset={row.variant}
              typeId={row.typeId}
              isMobile={isMobile}
            />
          </ReferenceRow>
        ))}
      </ReferenceList>
    </ReferencePage>
  );
}
