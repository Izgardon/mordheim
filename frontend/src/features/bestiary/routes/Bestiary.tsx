import { useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { inPlayOnly } from "@/features/reference/in-play";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import {
  DetailSection,
  Flavour,
  ReferenceDetail,
  RuleBlock,
  TagList,
} from "@/features/reference/ReferenceDetail";
import { FilterRow, ReferenceChips, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import {
  ReferenceList,
  ReferenceRow,
  ShowMore,
  useShownRows,
} from "@/features/reference/ReferenceList";
import { ProfileStrip, profileLine } from "@/features/reference/profile";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import { BEAST_KINDS, beastKindLabel, type BeastKind } from "../bestiary-kinds";
import BestiaryEntryFormDialog from "../components/BestiaryEntryFormDialog";
import { useBestiaryEntryDetail } from "../hooks/useBestiaryEntryDetail";
import type { BestiaryEntrySummary } from "../types/bestiary-types";
import { shopLine } from "../utils/beast-shop";

const PLURAL: Record<BeastKind, string> = { mount: "Mounts", pet: "Pets", creature: "Creatures" };

/** "Creature · Large · Wizard": a beast's kind and what marks it out. */
const kindLine = (entry: BestiaryEntrySummary) =>
  [
    beastKindLabel(entry.kind),
    entry.large ? "Large" : "",
    entry.caster && entry.caster !== "No" ? entry.caster : "",
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
 * The Bestiary (design E's reference layout): every beast in play in the campaign, searched by
 * name or text, a chip per kind (mounts, pets, creatures), rows with the kind, the profile and
 * the store's price; a row opens to its profile and specials. Beasts are added and edited as
 * today.
 */
export default function Bestiary() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const beasts = useCatalogue("bestiary", campaignId);
  const params = useReferenceParams(!beasts.isLoading);
  const capabilities = campaignCapabilities(campaign);
  const kind = params.get("kind", "all");
  /** The form: closed, adding (null) or editing a beast. */
  const [editing, setEditing] = useState<{ id: number | null } | null>(null);

  const sorted = useMemo(
    () => inPlayOnly(beasts.data).sort((a, b) => a.name.localeCompare(b.name)),
    [beasts.data]
  );
  const searched = sorted.filter((entry) =>
    matchesSearchQuery(params.query, entry.name, entry.description, beastKindLabel(entry.kind))
  );
  const rows = sorted.filter(
    (entry) =>
      String(entry.id) === params.openId ||
      (searched.includes(entry) && (kind === "all" || entry.kind === kind))
  );
  const shown = useShownRows(
    rows,
    rows.findIndex((entry) => String(entry.id) === params.openId)
  );
  const chips = [
    { id: "all", label: "All", count: searched.length },
    ...BEAST_KINDS.map((entryKind) => ({
      id: entryKind,
      label: PLURAL[entryKind],
      count: searched.filter((entry) => entry.kind === entryKind).length,
    })),
  ];

  return (
    <ReferencePage
      title="Bestiary"
      section="bestiary"
      archived={{
        kind: "bestiary",
        campaignId,
        canRestore: capabilities.edit_catalogue,
        noun: "beasts",
      }}
      actions={
        capabilities.edit_catalogue ? (
          <Button
            variant="secondary"
            className={isMobile ? "min-h-10" : undefined}
            onClick={() => setEditing({ id: null })}
          >
            Add beast
          </Button>
        ) : null
      }
      filters={
        <>
          <FilterRow isMobile={isMobile}>
            <ReferenceSearch
              value={params.query}
              onChange={params.setQuery}
              placeholder="Name or description"
              label="Search the bestiary"
              isMobile={isMobile}
            />
          </FilterRow>
          <ReferenceChips
            label="Kind"
            options={chips}
            value={kind}
            onChange={(next) => params.set({ kind: next === "all" ? null : next })}
            isMobile={isMobile}
          />
        </>
      }
      summary={
        isMobile ? undefined : `${rows.length} ${rows.length === 1 ? "beast" : "beasts"} shown`
      }
    >
      {beasts.error ? <p className="m-0 text-sm text-danger">{beasts.error}</p> : null}
      <ReferenceList
        nameLabel="Beast"
        columns={
          isMobile
            ? undefined
            : [
                { label: "Kind", className: "w-[170px] shrink-0" },
                { label: "Profile", className: "w-[210px] shrink-0" },
                { label: "In the store", className: "w-[230px] shrink-0 max-[1180px]:hidden" },
              ]
        }
        isEmpty={!beasts.isLoading && rows.length === 0}
        empty="No beasts match. Try another word or kind."
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
      <BestiaryEntryFormDialog
        campaignId={campaignId}
        open={editing !== null}
        onOpenChange={(open) => (open ? null : setEditing(null))}
        editingId={editing?.id ?? null}
        defaultKind={kind !== "all" ? (kind as BeastKind) : undefined}
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
