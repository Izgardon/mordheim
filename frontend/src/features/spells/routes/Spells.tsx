import { useMemo } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { inPlayOnly } from "@/features/reference/in-play";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { FilterRow, ReferenceChips, ReferenceSearch } from "@/features/reference/ReferenceFilters";
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

import SpellFormDialog from "../components/SpellFormDialog";
import type { Spell } from "../types/spell-types";

const loreOf = (spell: Spell) => (spell.type ?? "").replace(/_/g, " ") || "No lore";

/** "Difficulty 7", or "Auto" for a spell that needs no roll. */
export function difficultyLabel(spell: Spell) {
  const dc = spell.dc === null || spell.dc === undefined ? "" : String(spell.dc).trim();
  if (!dc) return "";
  return /^\d+$/.test(dc) ? `Difficulty ${dc}` : dc;
}

const compareSpells = (a: Spell, b: Spell) =>
  loreOf(a).localeCompare(loreOf(b)) ||
  (a.roll ?? 99) - (b.roll ?? 99) ||
  a.name.localeCompare(b.name);

/**
 * Spells (design E's reference layout): every spell in play in the campaign by lore, searched by
 * name or rules text, a chip per lore, rows with the lore, the D6 result and the difficulty; a
 * row opens to its rules in the warband page's rules panel. Custom spells are added and edited as today.
 */
export default function Spells() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const spells = useCatalogue("spells", campaignId);
  const params = useReferenceParams(!spells.isLoading);
  const capabilities = campaignCapabilities(campaign);
  const lore = params.get("lore", "all");

  const sorted = useMemo(() => inPlayOnly(spells.data).sort(compareSpells), [spells.data]);
  const lores = useMemo(() => [...new Set(sorted.map(loreOf))], [sorted]);
  const types = useMemo(
    () => [...new Set(sorted.map((spell) => spell.type ?? "").filter(Boolean))],
    [sorted]
  );
  const searched = sorted.filter((spell) =>
    matchesSearchQuery(params.query, spell.name, spell.type, spell.description)
  );
  const rows = sorted.filter(
    (spell) =>
      String(spell.id) === params.openId ||
      (searched.includes(spell) && (lore === "all" || loreOf(spell) === lore))
  );
  const shown = useShownRows(
    rows,
    rows.findIndex((spell) => String(spell.id) === params.openId)
  );
  const chips = [
    { id: "all", label: lores.length > 8 ? "All lores" : "All", count: searched.length },
    ...lores.map((name) => ({
      id: name,
      label: name,
      count: searched.filter((spell) => loreOf(spell) === name).length,
    })),
  ];

  const addButton = capabilities.edit_catalogue ? (
    <SpellFormDialog
      campaignId={campaignId}
      typeOptions={types}
      onSaved={(spell) => params.set({ open: String(spell.id), q: null })}
      trigger={
        <Button variant="secondary" className={isMobile ? "min-h-10" : undefined}>
          Add spell
        </Button>
      }
    />
  ) : null;

  return (
    <ReferencePage
      title="Spells"
      section="spells"
      archived={{
        kind: "spells",
        campaignId,
        canRestore: capabilities.edit_catalogue,
        noun: "spells",
      }}
      actions={addButton}
      filters={
        <>
          <FilterRow isMobile={isMobile}>
            <ReferenceSearch
              value={params.query}
              onChange={params.setQuery}
              placeholder="Search spells"
              label="Search spells"
              isMobile={isMobile}
            />
          </FilterRow>
          <ReferenceChips
            label="Lore"
            options={chips}
            value={lore}
            onChange={(next) => params.set({ lore: next === "all" ? null : next })}
            isMobile={isMobile}
          />
        </>
      }
      summary={
        isMobile ? undefined : `${rows.length} ${rows.length === 1 ? "spell" : "spells"} shown`
      }
    >
      {spells.error ? <p className="m-0 text-sm text-danger">{spells.error}</p> : null}
      <ReferenceList
        nameLabel="Spell"
        columns={
          isMobile
            ? undefined
            : [
                { label: "Lore", className: "w-[220px] shrink-0" },
                { label: "D6", className: "w-[48px] shrink-0" },
                { label: "Difficulty", className: "w-[120px] shrink-0" },
              ]
        }
        isEmpty={!spells.isLoading && rows.length === 0}
        empty="No spells match. Try another word or lore."
      >
        {spells.isLoading ? <ReferenceRowBones /> : null}
        {shown.rows.map((spell) => {
          const key = String(spell.id);
          const difficulty = difficultyLabel(spell);
          return (
            <ReferenceRow
              key={key}
              id={key}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
              name={spell.name}
              sub={isMobile ? loreOf(spell) : undefined}
              aside={
                difficulty ? (
                  <>
                    <span className="font-mono text-[13px] font-bold text-ink">
                      {difficulty.replace("Difficulty ", "")}
                    </span>
                    <span className="text-xs text-muted-foreground">difficulty</span>
                  </>
                ) : null
              }
              cells={
                isMobile
                  ? undefined
                  : [
                      loreOf(spell),
                      <span key="roll" className="font-mono">
                        {spell.roll ?? "–"}
                      </span>,
                      <span key="dc" className="font-mono font-bold text-ink">
                        {difficulty.replace("Difficulty ", "") || "–"}
                      </span>,
                    ]
              }
            >
              <div className={isMobile ? "flex flex-col gap-2" : "flex flex-col gap-2 px-4 pb-4"}>
                <RulesPanel
                  detail={{
                    name: spell.name,
                    kind: [loreOf(spell), spell.roll ? `D6 ${spell.roll}` : "", difficulty]
                      .filter(Boolean)
                      .join(" · "),
                    text: spell.description,
                  }}
                  onClose={params.close}
                />
                {capabilities.edit_catalogue ? (
                  <SpellFormDialog
                    campaignId={campaignId}
                    spell={spell}
                    typeOptions={types}
                    canDelete={capabilities.delete_catalogue}
                    onSaved={(saved) => params.set({ open: String(saved.id) })}
                    onDeleted={() => params.close()}
                    trigger={
                      <Button variant="secondary" className="min-h-10 self-start">
                        Edit spell
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
