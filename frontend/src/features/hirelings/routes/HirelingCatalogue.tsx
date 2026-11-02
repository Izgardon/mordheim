import { useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { useWhoCan } from "@/features/items/api/who-can-queries";
import { inPlayOnly } from "@/features/reference/in-play";
import ReferencePage from "@/features/reference/ReferencePage";
import { BuyableToggle, FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList, ShowMore, useShownRows } from "@/features/reference/ReferenceList";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useWarbandSheet } from "@/features/warbands/hooks/warband/useWarbandSheet";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import HireDialog from "../components/HireDialog";
import HirelingDetail from "../components/HirelingDetail";
import HirelingProfileFormDialog from "../components/HirelingProfileFormDialog";
import HirelingRow, { HIRELING_COLUMNS } from "../components/HirelingRow";
import {
  HIRELING_CATALOGUES,
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
 * entry in play in the campaign, searched by name, race or text, rows with race, hire fee, upkeep
 * and rating; a row opens to the profile, the terms, who can hire him and his rules, with Hire
 * from here (today's hire for your warband). It is also the roster's hire picker: Hire opens it for that warband
 * (`?warband=`, every entry, as before), with "Hire someone not in the list" for a custom hire.
 * With a warband, "Who it can hire" is on: those it can usually hire first (the server's who-can/),
 * the rest behind Show all with the reason. Entries are added and edited as today.
 */
export default function HirelingCatalogue({ kind }: { kind: HirelingCatalogueKind }) {
  const config = HIRELING_CATALOGUES[kind];
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const entries = useCatalogue(kind, campaignId);
  // The roster's Hire opens this page for its warband (?warband=): the hire picker
  const forWarband = Number(useSearchParams()[0].get("warband")) || null;
  const sheet = useWarbandSheet({ campaignId, hasCampaignId: Boolean(id), warbandId: forWarband });
  const { warband } = sheet;
  const params = useReferenceParams(!entries.isLoading);
  const capabilities = campaignCapabilities(campaign);
  const [editing, setEditing] = useState<{ id: number | null } | null>(null);
  const [hiring, setHiring] = useState<HirelingProfile | null>(null);
  const navigate = useNavigate();
  // a hire lands on the warband page with the new card in Edit; someone not in the list is hired
  // from the inline form at the top of its Hired swords
  const warbandPage = `/campaigns/${campaignId}/warband`;
  const whoCan = useWhoCan(campaignId, warband?.id);
  const access = kind === "hired-swords" ? whoCan.hiredSwords : whoCan.dramatisPersonae;
  const [onlyMine, setOnlyMine] = useState(true);
  const canHire = Boolean(warband) && sheet.capabilities.edit;
  const warningOf = (entry: HirelingProfile) => {
    if (!warband) return "";
    const row = access.get(entry.id);
    return row && !row.can_hire ? row.reason : "";
  };

  // Those the warband can usually hire first, then the rest; each part by name.
  const sorted = useMemo(
    () =>
      // the hire picker (?warband=) lists everyone, as before; the reference page only those in play
      (forWarband ? [...entries.data] : inPlayOnly(entries.data)).sort(
        (a, b) =>
          Number(access.get(a.id)?.can_hire === false) -
            Number(access.get(b.id)?.can_hire === false) || a.name.localeCompare(b.name)
      ),
    [access, entries.data, forWarband]
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
        <>
          {canHire ? (
            <Button
              variant="ghost"
              className={isMobile ? "min-h-10" : undefined}
              onClick={() => navigate(`${warbandPage}?recruit=hireling`)}
            >
              Hire someone not in the list
            </Button>
          ) : null}
          {capabilities.edit_catalogue ? (
            <Button
              variant="secondary"
              className={isMobile ? "min-h-10" : undefined}
              onClick={() => setEditing({ id: null })}
            >
              {isMobile ? "Add" : config.labels.add}
            </Button>
          ) : null}
        </>
      }
      filters={
        <FilterRow isMobile={isMobile}>
          <ReferenceSearch
            value={params.query}
            onChange={params.setQuery}
            placeholder={config.labels.search}
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
        columns={isMobile ? undefined : HIRELING_COLUMNS}
        isEmpty={!entries.isLoading && rows.length === 0}
        empty={sorted.length ? `${config.labels.noMatches}.` : `${config.labels.emptyTitle}.`}
      >
        {entries.isLoading ? <ReferenceRowBones /> : null}
        {shown.rows.map((entry) => {
          const key = String(entry.id);
          return (
            <HirelingRow
              key={key}
              entry={entry}
              warning={warningOf(entry)}
              isMobile={isMobile}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
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
            </HirelingRow>
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
          heroes={sheet.heroes}
          entry={hiring}
          onClose={() => setHiring(null)}
          onHired={(unitId) => navigate(`${warbandPage}?unit=hireling-${unitId}&edit=1`)}
        />
      ) : null}
    </ReferencePage>
  );
}
