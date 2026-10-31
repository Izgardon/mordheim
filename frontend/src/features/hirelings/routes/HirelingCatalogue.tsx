import { useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { allows, type Buyer } from "@/features/items/store/store-items";
import { useBuyer } from "@/features/items/store/useBuyer";
import { outOfPlay, useSettingsById } from "@/features/campaigns/api/settings-queries";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import {
  DetailSection,
  FactLine,
  Flavour,
  ReferenceDetail,
  RuleBlock,
  TagList,
} from "@/features/reference/ReferenceDetail";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import {
  ReferenceList,
  ReferenceRow,
  ShowMore,
  useShownRows,
} from "@/features/reference/ReferenceList";
import { ProfileStrip } from "@/features/reference/profile";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useWarbandSheet } from "@/features/warbands/hooks/warband/useWarbandSheet";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import HireDialog from "../components/HireDialog";
import HirelingProfileFormDialog from "../components/HirelingProfileFormDialog";
import {
  HIRELING_CATALOGUES,
  formatHirelingCost,
  hirelingRace,
  type HirelingCatalogueConfig,
  type HirelingCatalogueKind,
} from "../hireling-catalogue-kinds";
import { useHirelingProfileDetail } from "../hooks/useHirelingProfileDetail";
import type { HirelingProfile } from "../types/hireling-catalogue-types";
import { personaTermsLine } from "../utils/hireling-display";

const SECTION: Record<HirelingCatalogueKind, { path: string; title: string }> = {
  "hired-swords": { path: "hired-swords", title: "Hired swords" },
  "dramatis-personae": { path: "dramatis-personae", title: "Dramatis personae" },
};

/** The open entry: profile, terms, who can hire him, his rules and kit (read on opening). */
function HirelingDetail({
  config,
  campaignId,
  entry,
  buyer,
  isMobile,
  onHire,
  onEdit,
}: {
  config: HirelingCatalogueConfig;
  campaignId: number;
  entry: HirelingProfile;
  buyer: Buyer | null;
  isMobile: boolean;
  onHire?: () => void;
  onEdit?: () => void;
}) {
  const detail = useHirelingProfileDetail(config.kind, campaignId, entry.id);
  const full = detail.entry;
  const terms = config.hasPersonaTerms ? personaTermsLine(entry) : "";
  const rules = full
    ? [
        ...full.specials.map((special) => ({ key: `special-${special.id}`, ...special })),
        ...full.skills.map((skill) => ({ key: `skill-${skill.id}`, ...skill })),
        ...full.spells.map((spell) => ({
          key: `spell-${spell.id}`,
          ...spell,
          description: spell.description ?? "",
        })),
      ]
    : [];
  const aside = (
    <>
      {onHire ? (
        <Button className="min-h-11 w-full" onClick={onHire}>
          Hire from here
        </Button>
      ) : null}
      <DetailSection title="Who can hire">
        {entry.restrictions.length ? (
          <TagList
            tags={entry.restrictions.map((link) => ({
              label: link.additional_note
                ? `${link.restriction.restriction} (${link.additional_note})`
                : link.restriction.restriction,
              mine: buyer ? allows(link.restriction, buyer) : false,
            }))}
          />
        ) : (
          <span className="text-[13px] text-ink">Any warband</span>
        )}
      </DetailSection>
      {entry.available_skill_types.length ? (
        <DetailSection title="Skill lists">
          <TagList tags={entry.available_skill_types.map((type) => ({ label: type }))} />
        </DetailSection>
      ) : null}
      {full?.equipment.length ? (
        <DetailSection title="Carries">
          <TagList
            tags={full.equipment.map(({ item, quantity }) => ({
              label: quantity > 1 ? `${item.name} ×${quantity}` : item.name,
            }))}
          />
        </DetailSection>
      ) : null}
      {entry.grade ? (
        <DetailSection title="Source">
          <span className="text-[13px] text-ink">Grade {entry.grade}</span>
        </DetailSection>
      ) : null}
      {onEdit ? (
        <Button variant="secondary" className="min-h-10 self-start" onClick={onEdit}>
          Edit {config.labels.noun}
        </Button>
      ) : null}
    </>
  );
  return (
    <ReferenceDetail
      title={entry.name}
      kind={hirelingRace(entry)}
      isMobile={isMobile}
      aside={aside}
    >
      {entry.description?.trim() ? <Flavour>{entry.description}</Flavour> : null}
      <FactLine
        facts={[
          {
            label: "Hire fee",
            value: formatHirelingCost(entry.hire_cost, entry.hire_cost_expression),
          },
          {
            label: "Upkeep",
            value: formatHirelingCost(entry.upkeep_cost, entry.upkeep_cost_expression),
          },
          ...(entry.rating !== null ? [{ label: "Rating", value: `+${entry.rating}` }] : []),
          ...(terms ? [{ label: "Terms", value: terms }] : []),
        ]}
      />
      <ProfileStrip profile={entry} />
      {detail.error && !full ? <p className="m-0 text-sm text-danger">{detail.error}</p> : null}
      {!full && !detail.error ? (
        <span className="text-[13px] text-muted-foreground">Reading his rules…</span>
      ) : null}
      {rules.length ? (
        <div className="flex flex-col gap-2.5">
          {rules.map((rule) => (
            <RuleBlock key={rule.key} name={rule.name}>
              {rule.description}
            </RuleBlock>
          ))}
        </div>
      ) : null}
    </ReferenceDetail>
  );
}

/**
 * Hired swords and Dramatis personae (design E's reference layout, one page for both): every
 * entry, searched by name, race or text, rows with race, hire fee, upkeep and rating; a row opens
 * to the profile, the terms, who can hire him and his rules, with Hire from here (today's hire
 * for your warband). Entries are added and edited as today.
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
  const buyer = useBuyer(warband, campaign?.setting_ids);
  const settings = useSettingsById();
  const canHire = Boolean(warband) && sheet.capabilities.edit;

  const sorted = useMemo(
    () => [...entries.data].sort((a, b) => a.name.localeCompare(b.name)),
    [entries.data]
  );
  const rows = sorted.filter(
    (entry) =>
      String(entry.id) === params.openId ||
      matchesSearchQuery(params.query, entry.name, hirelingRace(entry), entry.description)
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
        {entries.isLoading ? <ReferenceRowBones /> : null}
        {shown.rows.map((entry) => {
          const key = String(entry.id);
          const fee = formatHirelingCost(entry.hire_cost, entry.hire_cost_expression);
          const upkeep = formatHirelingCost(entry.upkeep_cost, entry.upkeep_cost_expression);
          const warning = outOfPlay(entry, settings);
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
                buyer={buyer}
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
