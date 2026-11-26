import { useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities, canEditEntry } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import {
  DetailSection,
  Flavour,
  ReferenceDetail,
  RuleBlock,
  TagList,
} from "@/features/reference/ReferenceDetail";
import { FilterLine } from "@/features/reference/FilterLine";
import { listSort } from "@/features/reference/list-sort";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import {
  ReferenceList,
  ReferenceRow,
  ShowMore,
  useShownRows,
} from "@/features/reference/ReferenceList";
import { ProfileStrip, profileLine } from "@/features/reference/profile";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useCatalogue } from "@/lib/catalogue-queries";
import { useMediaQuery } from "@/lib/use-media-query";

import { beastKindLabel } from "../bestiary-kinds";
import { BEAST_SORTS, beastRows } from "../bestiary-rows";
import BestiaryEntryFormDialog from "../components/BestiaryEntryFormDialog";
import { useBestiaryEntryDetail } from "../hooks/useBestiaryEntryDetail";
import type { BestiaryEntrySummary } from "../types/bestiary-types";
import { shopLine } from "../utils/beast-shop";

/** "Creature · Large · Wizard · Rating 40": a beast's kind, what marks it out and its rating. */
const kindLine = (entry: BestiaryEntrySummary) =>
  [
    beastKindLabel(entry.kind),
    entry.large ? "Large" : "",
    entry.caster && entry.caster !== "No" ? entry.caster : "",
    entry.rating !== null && entry.rating !== undefined ? `Rating ${entry.rating}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

/** The open beast: its profile, specials, skills, spells and kit (read on opening). */
function BeastDetail({
  campaignId,
  entry,
  isMobile,
  onEdit,
}: {
  campaignId: number;
  entry: BestiaryEntrySummary;
  isMobile: boolean;
  onEdit?: () => void;
}) {
  const detail = useBestiaryEntryDetail(campaignId, entry.id);
  const full = detail.entry;
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
      <DetailSection title="In the store">
        <span className="text-[13px] text-ink">{shopLine(entry)}</span>
      </DetailSection>
      {full?.equipment.length ? (
        <DetailSection title="Carries">
          <TagList
            tags={full.equipment.map(({ item, quantity }) => ({
              label: quantity > 1 ? `${item.name} ×${quantity}` : item.name,
            }))}
          />
        </DetailSection>
      ) : null}
      {entry.kind === "mount" && entry.rating_bonus ? (
        <DetailSection title="Rating">
          <span className="text-[13px] text-ink">+{entry.rating_bonus} to its rider</span>
        </DetailSection>
      ) : null}
      {onEdit ? (
        <Button variant="secondary" className="min-h-10 self-start" onClick={onEdit}>
          Edit entry
        </Button>
      ) : null}
    </>
  );
  return (
    <ReferenceDetail title={entry.name} kind={kindLine(entry)} isMobile={isMobile} aside={aside}>
      {entry.description?.trim() ? <Flavour>{entry.description}</Flavour> : null}
      {entry.has_profile ? (
        <ProfileStrip profile={entry} />
      ) : (
        <span className="text-[13px] text-muted-foreground">No profile.</span>
      )}
      {detail.error && !full ? <p className="m-0 text-sm text-danger">{detail.error}</p> : null}
      {!full && !detail.error ? (
        <span className="text-[13px] text-muted-foreground">Reading its rules…</span>
      ) : null}
      {rules.length ? (
        <div className="flex flex-col gap-2.5">
          {rules.map((rule) => (
            <RuleBlock
              key={rule.key}
              name={rule.name}
              kind={"kind" in rule ? rule.kind : undefined}
              category={"category" in rule ? rule.category : undefined}
            >
              {rule.description}
            </RuleBlock>
          ))}
        </div>
      ) : null}
    </ReferenceDetail>
  );
}

/**
 * The Bestiary (design E's reference layout): every beast in play in the campaign, searched by
 * name or text, rows with the kind, the profile and the store's price, by name, cost or kind
 * (`?sort=`: the headings on the web, the arrows button on a phone); a row opens to its profile
 * and specials. Beasts are added and edited as today.
 */
export default function Bestiary() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const beasts = useCatalogue("bestiary", campaignId);
  const params = useReferenceParams(!beasts.isLoading);
  const capabilities = campaignCapabilities(campaign);
  const sort = listSort(params, BEAST_SORTS);
  /** The form: closed, adding (null) or editing a beast. */
  const [editing, setEditing] = useState<{ id: number | null } | null>(null);

  const rows = beastRows(beasts.data, {
    query: params.query,
    openId: params.openId,
    sort: sort.value,
  });
  const shown = useShownRows(
    rows,
    rows.findIndex((entry) => String(entry.id) === params.openId)
  );
  return (
    <ReferencePage
      title="Bestiary"
      section="bestiary"
      archived={
        capabilities.archived_catalogue
          ? {
              kind: "bestiary",
              campaignId,
              canRestore: capabilities.edit_catalogue,
              noun: "beasts",
            }
          : undefined
      }
      actions={
        capabilities.edit_catalogue ? (
          <Button
            variant="secondary"
            className={isMobile ? "min-h-10" : undefined}
            onClick={() => setEditing({ id: null })}
          >
            Add new
          </Button>
        ) : null
      }
      filters={
        <>
          <FilterRow isMobile={isMobile}>
            <ReferenceSearch
              value={params.query}
              onChange={params.setQuery}
              placeholder="Search the bestiary"
              label="Search the bestiary"
              isMobile={isMobile}
            />
          </FilterRow>
          <FilterLine isMobile={isMobile} sort={sort.menu} />
        </>
      }
      summary={
        isMobile ? undefined : `${rows.length} ${rows.length === 1 ? "beast" : "beasts"} shown`
      }
    >
      {beasts.error ? <p className="m-0 text-sm text-danger">{beasts.error}</p> : null}
      <ReferenceList
        nameLabel="Beast"
        nameSort={isMobile ? undefined : sort.heading("name")}
        columns={
          isMobile
            ? undefined
            : [
                { label: "Kind", className: "w-[170px] shrink-0", sort: sort.heading("kind") },
                { label: "Profile", className: "w-[210px] shrink-0" },
                {
                  label: "In the store",
                  className: "w-[230px] shrink-0 max-[1180px]:hidden",
                  sort: sort.heading("cost", "-cost"),
                },
              ]
        }
        isEmpty={!beasts.isLoading && rows.length === 0}
        empty="No beasts match."
      >
        {beasts.isLoading ? <ReferenceRowBones /> : null}
        {shown.rows.map((entry) => {
          const key = String(entry.id);
          const profile = entry.has_profile ? profileLine(entry) : "No profile";
          return (
            <ReferenceRow
              key={key}
              id={key}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
              name={entry.name}
              sub={isMobile ? `${kindLine(entry)} · ${profile}` : undefined}
              cells={
                isMobile
                  ? undefined
                  : [
                      kindLine(entry),
                      <span key="profile" className="font-mono text-xs">
                        {profile}
                      </span>,
                      shopLine(entry),
                    ]
              }
            >
              <BeastDetail
                campaignId={campaignId}
                entry={entry}
                isMobile={isMobile}
                onEdit={
                  canEditEntry(capabilities, entry) ? () => setEditing({ id: entry.id }) : undefined
                }
              />
            </ReferenceRow>
          );
        })}
      </ReferenceList>
      {rows.length > 0 ? (
        <ShowMore shown={shown.rows.length} total={rows.length} onMore={shown.showMore} />
      ) : null}
      <BestiaryEntryFormDialog
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
    </ReferencePage>
  );
}
