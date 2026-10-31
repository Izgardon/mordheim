import { useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { outOfPlay, useSettingsById } from "@/features/campaigns/api/settings-queries";
import { useWhoCan } from "@/features/items/api/who-can-queries";
import ReferencePage from "@/features/reference/ReferencePage";
import { BuyableToggle, FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import {
  ReferenceList,
  ReferenceRow,
  ShowMore,
  useShownRows,
} from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useWarbandSheet } from "@/features/warbands/hooks/warband/useWarbandSheet";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import HireDialog from "../components/HireDialog";
import HirelingDetail from "../components/HirelingDetail";
import HirelingProfileFormDialog from "../components/HirelingProfileFormDialog";
import {
  HIRELING_CATALOGUES,
  formatHirelingCost,
  hirelingRace,
  type HirelingCatalogueKind,
} from "../hireling-catalogue-kinds";
import type { HirelingProfile } from "../types/hireling-catalogue-types";

const SECTION: Record<HirelingCatalogueKind, { path: string; title: string }> = {
  "hired-swords": { path: "hired-swords", title: "Hired swords" },
  "dramatis-personae": { path: "dramatis-personae", title: "Dramatis personae" },
};

/**
 * Hired swords and Dramatis personae (design E's reference layout, one page for both): every
 * entry, searched by name, race or text, rows with race, hire fee, upkeep and rating; a row opens
 * to the profile, the terms, who can hire him and his rules, with Hire from here (today's hire
 * for your warband). With a warband, "Who it can hire" is on: those it can usually hire first
 * (the server's who-can/), the rest behind Show all with the reason. Entries are added and edited
 * as today.
 */
export default function HirelingCatalogue({ kind }: { kind: HirelingCatalogueKind }) {
  const config = HIRELING_CATALOGUES[kind];
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const entries = useCatalogue(kind, campaignId);
  const sheet = useWarbandSheet({ campaignId, hasCampaignId: Boolean(id), warbandId: null });
  const { warband } = sheet;
  const params = useReferenceParams(!entries.isLoading);
  const capabilities = campaignCapabilities(campaign);
  const [editing, setEditing] = useState<{ id: number | null } | null>(null);
  const [hiring, setHiring] = useState<HirelingProfile | null>(null);
  const settings = useSettingsById();
  const whoCan = useWhoCan(campaignId, warband?.id);
  const access = kind === "hired-swords" ? whoCan.hiredSwords : whoCan.dramatisPersonae;
  const [onlyMine, setOnlyMine] = useState(true);
  const canHire = Boolean(warband) && sheet.capabilities.edit;
  const warningOf = (entry: HirelingProfile) => {
    if (!warband) return outOfPlay(entry, settings);
    const row = access.get(entry.id);
    return row && !row.can_hire ? row.reason : "";
  };

  // Those the warband can usually hire first, then the rest; each part by name.
  const sorted = useMemo(
    () =>
      [...entries.data].sort(
        (a, b) =>
          Number(access.get(a.id)?.can_hire === false) -
            Number(access.get(b.id)?.can_hire === false) || a.name.localeCompare(b.name)
      ),
    [access, entries.data]
  );
  const rows = sorted.filter(
    (entry) =>
      String(entry.id) === params.openId ||
      ((!warband || !onlyMine || !warningOf(entry)) &&
        matchesSearchQuery(params.query, entry.name, hirelingRace(entry), entry.description))
  );
  const shown = useShownRows(
    rows,
    rows.findIndex((entry) => String(entry.id) === params.openId)
  );
  const noun = (n: number) => (n === 1 ? config.labels.noun : SECTION[kind].title.toLowerCase());

  return (
    <ReferencePage
      title={SECTION[kind].title}
      section={SECTION[kind].path}
      archived={{
        kind,
        campaignId,
        canRestore: capabilities.edit_catalogue,
        noun: kind === "hired-swords" ? "hired swords" : "dramatis personae",
      }}
      actions={
        capabilities.edit_catalogue ? (
          <Button
            variant="secondary"
            className={isMobile ? "min-h-10" : undefined}
            onClick={() => setEditing({ id: null })}
          >
            {isMobile ? "Add" : config.labels.add}
          </Button>
        ) : null
      }
      filters={
        <FilterRow isMobile={isMobile}>
          <ReferenceSearch
            value={params.query}
            onChange={params.setQuery}
            placeholder="Name, race or text"
            label={config.labels.search}
            isMobile={isMobile}
          />
          {warband ? (
            <BuyableToggle
              warbandName={warband.name}
              verb="hire"
              checked={onlyMine}
              onChange={setOnlyMine}
              isMobile={isMobile}
            />
          ) : null}
        </FilterRow>
      }
      summary={isMobile ? undefined : `${rows.length} ${noun(rows.length)} shown`}
    >
      {entries.error ? <p className="m-0 text-sm text-danger">{entries.error}</p> : null}
      <ReferenceList
        nameLabel={config.labels.singular}
        columns={
          isMobile
            ? undefined
            : [
                { label: "Race", className: "w-[160px] shrink-0" },
                { label: "Hire fee", className: "w-[120px] shrink-0" },
                { label: "Upkeep", className: "w-[120px] shrink-0" },
                { label: "Rating", className: "w-[64px] shrink-0" },
              ]
        }
        isEmpty={!entries.isLoading && rows.length === 0}
        empty={
          sorted.length
            ? `${config.labels.noMatches}.`
            : `${config.labels.emptyTitle}. ${config.labels.emptyBody}`
        }
      >
        {entries.isLoading ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Asking around the taverns…</li>
        ) : null}
        {shown.rows.map((entry) => {
          const key = String(entry.id);
          const fee = formatHirelingCost(entry.hire_cost, entry.hire_cost_expression);
          const upkeep = formatHirelingCost(entry.upkeep_cost, entry.upkeep_cost_expression);
          const warning = warningOf(entry);
          return (
            <ReferenceRow
              key={key}
              id={key}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
              name={entry.name}
              warn={warning}
              dim={Boolean(warning)}
              sub={
                isMobile
                  ? [hirelingRace(entry), entry.rating !== null ? `Rating +${entry.rating}` : ""]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined
              }
              aside={
                <>
                  <span className="font-mono text-[13px] font-bold text-ink">{fee}</span>
                  <span className="text-xs text-muted-foreground">upkeep {upkeep}</span>
                </>
              }
              cells={
                isMobile
                  ? undefined
                  : [
                      hirelingRace(entry) || "–",
                      <span key="fee" className="font-mono font-bold text-ink">
                        {fee}
                      </span>,
                      <span key="upkeep" className="font-mono">
                        {upkeep}
                      </span>,
                      <span key="rating" className="font-mono">
                        {entry.rating !== null ? `+${entry.rating}` : "–"}
                      </span>,
                    ]
              }
            >
              <HirelingDetail
                config={config}
                campaignId={campaignId}
                entry={entry}
                access={warband ? access.get(entry.id) : undefined}
                isMobile={isMobile}
                onHire={canHire ? () => setHiring(entry) : undefined}
                onEdit={
                  capabilities.edit_catalogue ? () => setEditing({ id: entry.id }) : undefined
                }
              />
            </ReferenceRow>
          );
        })}
      </ReferenceList>
      {rows.length > 0 ? (
        <ShowMore shown={shown.rows.length} total={rows.length} onMore={shown.showMore} />
      ) : null}
      <HirelingProfileFormDialog
        config={config}
        campaignId={campaignId}
        open={editing !== null}
        onOpenChange={(open) => (open ? null : setEditing(null))}
        editingId={editing?.id ?? null}
        canDelete={capabilities.delete_catalogue}
        onSaved={(saved) => {
          setEditing(null);
          params.set({ open: String(saved.id) });
        }}
        onDeleted={() => {
          setEditing(null);
          params.close();
        }}
        onEditMatch={(match) => setEditing({ id: match.id })}
      />
      {warband ? (
        <HireDialog
          config={config}
          campaignId={campaignId}
          warband={warband}
          entry={hiring}
          onClose={() => setHiring(null)}
        />
      ) : null}
    </ReferencePage>
  );
}
